from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field


# ---------------- Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']
ACCESS_TOKEN_EXPIRE_DAYS = 30  # mobile token

DEFAULT_TEMPLATE = (
    "Congratulations! Your ID is created. Your User ID is {user_id} and password is {password}. "
    "Pragati Path is designed for Winners and we believe each child is a winner."
)

app = FastAPI(title="Pragati Path API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ---------------- Helpers ----------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name"),
        "phone": u.get("phone"),
        "child_name": u.get("child_name"),
        "child_age": u.get("child_age"),
        "child_class": u.get("child_class"),
        "user_id_code": u.get("user_id_code"),
        "role": u.get("role", "parent"),
        "enrollment_status": u.get("enrollment_status", "pending"),
        "created_at": u.get("created_at"),
    }


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ---------------- Schemas ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None
    child_name: str
    child_age: Optional[int] = None
    child_class: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: dict


class UpiSettingsIn(BaseModel):
    upi_id: str
    qr_image_base64: Optional[str] = None
    fee_amount: Optional[float] = None
    instructions: Optional[str] = None


class PaymentCreateIn(BaseModel):
    amount: float
    utr: Optional[str] = None
    screenshot_base64: Optional[str] = None
    note: Optional[str] = None


class PaymentDecisionIn(BaseModel):
    decision: Literal["approve", "reject"]
    admin_note: Optional[str] = None


class AdIn(BaseModel):
    title: str
    body: Optional[str] = None
    image_base64: Optional[str] = None
    active: bool = True


class TemplateIn(BaseModel):
    template: str


# ---------------- Auth ----------------
@api_router.post("/auth/register", response_model=TokenOut)
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_id_code = "PP" + user_id[:6].upper()
    doc = {
        "id": user_id,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "phone": body.phone,
        "child_name": body.child_name,
        "child_age": body.child_age,
        "child_class": body.child_class,
        "user_id_code": user_id_code,
        "role": "parent",
        "enrollment_status": "pending",
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    token = create_token(user_id, email, "parent")
    return {"token": token, "user": clean_user(doc)}


@api_router.post("/auth/login", response_model=TokenOut)
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], email, user.get("role", "parent"))
    return {"token": token, "user": clean_user(user)}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return clean_user(user)


# ---------------- UPI Settings ----------------
@api_router.get("/upi-settings")
async def get_upi(user: dict = Depends(get_current_user)):
    settings = await db.upi_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {"upi_id": "", "qr_image_base64": "", "fee_amount": 0, "instructions": ""}
    return settings


@api_router.put("/admin/upi-settings")
async def update_upi(body: UpiSettingsIn, admin: dict = Depends(require_admin)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["updated_at"] = now_iso()
    await db.upi_settings.update_one(
        {"id": "default"},
        {"$set": update, "$setOnInsert": {"id": "default"}},
        upsert=True,
    )
    s = await db.upi_settings.find_one({"id": "default"}, {"_id": 0})
    return s


# ---------------- Payments ----------------
@api_router.post("/payments")
async def create_payment(body: PaymentCreateIn, user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admins cannot create payments")
    pid = str(uuid.uuid4())
    doc = {
        "id": pid,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user.get("name"),
        "child_name": user.get("child_name"),
        "amount": body.amount,
        "utr": body.utr,
        "screenshot_base64": body.screenshot_base64,
        "note": body.note,
        "status": "pending",
        "admin_note": None,
        "created_at": now_iso(),
        "decided_at": None,
    }
    await db.payments.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/payments/me")
async def my_payments(user: dict = Depends(get_current_user)):
    items = await db.payments.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/admin/payments")
async def all_payments(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    items = await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/admin/payments/{payment_id}/decide")
async def decide_payment(payment_id: str, body: PaymentDecisionIn, admin: dict = Depends(require_admin)):
    payment = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if payment["status"] != "pending":
        raise HTTPException(status_code=400, detail="Payment already decided")

    new_status = "approved" if body.decision == "approve" else "rejected"
    await db.payments.update_one(
        {"id": payment_id},
        {"$set": {"status": new_status, "admin_note": body.admin_note, "decided_at": now_iso()}},
    )

    user = await db.users.find_one({"id": payment["user_id"]}, {"_id": 0})
    if user:
        if new_status == "approved":
            new_password = uuid.uuid4().hex[:8]
            await db.users.update_one(
                {"id": user["id"]},
                {"$set": {
                    "enrollment_status": "enrolled",
                    "password_hash": hash_password(new_password),
                    "issued_password": new_password,
                }},
            )
            tpl_doc = await db.settings.find_one({"id": "auto_message"}, {"_id": 0})
            template = tpl_doc.get("template") if tpl_doc else DEFAULT_TEMPLATE
            user_id_code = user.get("user_id_code") or user["id"][:8]
            text = template.replace("{user_id}", user_id_code).replace("{password}", new_password)
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": "🎉 Enrollment Successful",
                "body": text,
                "type": "enrollment",
                "read": False,
                "created_at": now_iso(),
            })
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": "Child Enrolled",
                "body": f"Your child {user.get('child_name','')} is successfully registered with Pragati Path.",
                "type": "info",
                "read": False,
                "created_at": now_iso(),
            })
        else:
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": "Payment Rejected",
                "body": f"Your payment was rejected. {body.admin_note or ''}".strip(),
                "type": "payment",
                "read": False,
                "created_at": now_iso(),
            })

    updated = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    return updated


# ---------------- Advertisements ----------------
@api_router.get("/ads")
async def list_active_ads(user: dict = Depends(get_current_user)):
    items = await db.ads.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api_router.get("/admin/ads")
async def all_ads(admin: dict = Depends(require_admin)):
    items = await db.ads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.post("/admin/ads")
async def create_ad(body: AdIn, admin: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_iso()}
    await db.ads.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/ads/{ad_id}")
async def update_ad(ad_id: str, body: AdIn, admin: dict = Depends(require_admin)):
    res = await db.ads.update_one({"id": ad_id}, {"$set": body.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return await db.ads.find_one({"id": ad_id}, {"_id": 0})


@api_router.delete("/admin/ads/{ad_id}")
async def delete_ad(ad_id: str, admin: dict = Depends(require_admin)):
    res = await db.ads.delete_one({"id": ad_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"ok": True}


# ---------------- Notifications ----------------
@api_router.get("/notifications/me")
async def my_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.post("/notifications/{notif_id}/read")
async def read_notif(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


# ---------------- Admin: Users + Template ----------------
@api_router.get("/admin/users")
async def list_users(admin: dict = Depends(require_admin)):
    items = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.get("/admin/template")
async def get_template(admin: dict = Depends(require_admin)):
    tpl_doc = await db.settings.find_one({"id": "auto_message"}, {"_id": 0})
    return {"template": tpl_doc.get("template") if tpl_doc else DEFAULT_TEMPLATE}


@api_router.put("/admin/template")
async def update_template(body: TemplateIn, admin: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"id": "auto_message"},
        {"$set": {"template": body.template, "updated_at": now_iso()}, "$setOnInsert": {"id": "auto_message"}},
        upsert=True,
    )
    return {"template": body.template}


@api_router.get("/admin/stats")
async def admin_stats(admin: dict = Depends(require_admin)):
    pending = await db.payments.count_documents({"status": "pending"})
    approved = await db.payments.count_documents({"status": "approved"})
    users = await db.users.count_documents({"role": {"$ne": "admin"}})
    enrolled = await db.users.count_documents({"role": "parent", "enrollment_status": "enrolled"})
    ads = await db.ads.count_documents({"active": True})
    return {
        "pending_payments": pending,
        "approved_payments": approved,
        "total_users": users,
        "enrolled_users": enrolled,
        "active_ads": ads,
    }


@api_router.get("/")
async def root():
    return {"message": "Pragati Path API", "ok": True}


# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.payments.create_index("user_id")
    await db.notifications.create_index("user_id")

    # seed admin
    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "name": "Pragati Admin",
            "role": "admin",
            "user_id_code": "ADMIN",
            "enrollment_status": "n/a",
            "created_at": now_iso(),
        })
        logger.info("Seeded default admin: %s", admin_email)
    else:
        # keep password in sync with .env
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
            )

    # seed default template
    if not await db.settings.find_one({"id": "auto_message"}):
        await db.settings.insert_one({"id": "auto_message", "template": DEFAULT_TEMPLATE})

    # seed default UPI
    if not await db.upi_settings.find_one({"id": "default"}):
        await db.upi_settings.insert_one({
            "id": "default",
            "upi_id": "pragatipath@upi",
            "qr_image_base64": "",
            "fee_amount": 5000.0,
            "instructions": "Pay using any UPI app, then upload the screenshot or enter the UTR/Transaction ID.",
        })

    # seed sample ad
    if await db.ads.count_documents({}) == 0:
        await db.ads.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Welcome to Pragati Path",
            "body": "Designed for Winners — every child is a winner. New batch admissions open!",
            "image_base64": "",
            "active": True,
            "created_at": now_iso(),
        })


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
