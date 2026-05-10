from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.responses import HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from scalar_fastapi import get_scalar_api_reference


# ---------------- Setup ----------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ['JWT_SECRET']
ACCESS_TOKEN_EXPIRE_DAYS = 30

DEFAULT_TEMPLATE = (
    "Congratulations! Your ID is created. Your User ID is {user_id} and password is {password}. "
    "Pragati Path is designed for Winners and we believe each child is a winner."
)

API_DESCRIPTION = """
**Pragati Path** is a coaching-centre management mobile platform for parents and admins.

This REST API powers the Expo mobile app and supports:

* 🔐 **JWT auth** — register / login parents and admins (Bearer tokens, 30-day expiry)
* 👨‍👩‍👧 **Multi-child management** — parents can register multiple children with class 1–10
* 🛒 **Shop & Payments** — courses, study materials, T-shirts; UPI screenshot uploads, admin approval
* 📚 **Content** — YouTube classes, attendance, in-app inbox notifications
* 💸 **Wallet & Referrals** — commission earnings, withdrawals, referral codes & QR codes
* ⭐ **Feedback** — ratings + suggestions, admin reply, push notifications via Expo

All endpoints are prefixed with `/api`. Send the JWT token as `Authorization: Bearer <token>` header.

> 📖 **Read the docs first:** `docs/getting-started.md` for end-to-end usage.
"""

TAGS_METADATA = [
    {"name": "Authentication", "description": "Register, login & current user profile."},
    {"name": "Children", "description": "Manage children profiles (multi-child per parent)."},
    {"name": "Shop", "description": "Browse purchasable items (courses, materials, merch)."},
    {"name": "Payments", "description": "Submit UPI payment screenshots, view receipts."},
    {"name": "Attendance", "description": "View own child's attendance records."},
    {"name": "Notifications", "description": "Inbox messages — mark read, list unread."},
    {"name": "Videos", "description": "YouTube class video links."},
    {"name": "Wallet", "description": "Commission balance, transactions & withdrawal requests."},
    {"name": "Feedback", "description": "Ratings, suggestions, view admin replies."},
    {"name": "Push Notifications", "description": "Register/unregister Expo push token for the device."},
    {"name": "Public", "description": "Unauthenticated endpoints (UPI settings, ads, health)."},
    {"name": "Admin · Dashboard", "description": "[admin] Stats counters."},
    {"name": "Admin · Users", "description": "[admin] List parents/children, reset passwords."},
    {"name": "Admin · Shop", "description": "[admin] Create / edit / delete shop items."},
    {"name": "Admin · Payments", "description": "[admin] Approve or reject UPI submissions."},
    {"name": "Admin · Attendance", "description": "[admin] Mark daily attendance."},
    {"name": "Admin · Messaging", "description": "[admin] Compose inbox messages with optional image; auto-fires push."},
    {"name": "Admin · Videos", "description": "[admin] Add / remove YouTube class links."},
    {"name": "Admin · Wallet", "description": "[admin] Approve or reject withdrawal requests."},
    {"name": "Admin · Referrals", "description": "[admin] Configure commission rates, view referral graph."},
    {"name": "Admin · Feedback", "description": "[admin] View ratings/suggestions, reply to users."},
    {"name": "Admin · Ads", "description": "[admin] Update advertisement banner."},
    {"name": "Admin · Settings", "description": "[admin] UPI ID, welcome message template."},
]

app = FastAPI(
    title="Pragati Path API",
    description=API_DESCRIPTION,
    version="1.0.0",
    contact={"name": "Pragati Path Support", "email": "support@pragatipath.com"},
    license_info={"name": "Proprietary"},
    openapi_tags=TAGS_METADATA,
    docs_url="/api/docs/swagger",
    redoc_url="/api/docs/redoc",
    openapi_url="/api/openapi.json",
)


@app.get("/api/docs/scalar", include_in_schema=False)
async def scalar_html():
    return get_scalar_api_reference(
        openapi_url=app.openapi_url,
        title="Pragati Path API · Scalar Reference",
    )


@app.get("/api/docs", include_in_schema=False)
async def docs_landing():
    html = """<!doctype html><html><head><meta charset='utf-8'><title>Pragati Path API Docs</title>
    <style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;margin:60px auto;padding:0 20px;color:#0A1F3A;}
    h1{font-size:28px;margin-bottom:8px;} .sub{color:#6B7280;margin-bottom:32px;}
    a.btn{display:block;padding:18px 20px;border-radius:14px;background:#0A1F3A;color:#fff;text-decoration:none;margin-bottom:12px;font-weight:600;transition:transform .15s;}
    a.btn:hover{transform:translateY(-2px);} a.btn small{display:block;color:#9CA3AF;font-weight:400;font-size:12px;margin-top:4px;}
    a.btn.alt{background:#F3F4F6;color:#0A1F3A;} a.btn.alt small{color:#6B7280;}
    code{background:#F3F4F6;padding:2px 6px;border-radius:4px;font-size:13px;}</style></head>
    <body><h1>📖 Pragati Path API Documentation</h1>
    <p class='sub'>Coaching-centre management API · v1.0.0 · OpenAPI 3.1</p>
    <a class='btn' href='/api/docs/scalar'>🚀 Open Scalar Reference <small>Modern, searchable, "Try it out" UI</small></a>
    <a class='btn alt' href='/api/docs/swagger'>📑 Swagger UI <small>Classic interactive docs</small></a>
    <a class='btn alt' href='/api/docs/redoc'>📘 ReDoc <small>Three-panel reference style</small></a>
    <a class='btn alt' href='/api/openapi.json'>📦 Raw OpenAPI JSON <small>Download / import into Postman, Insomnia, Bruno</small></a>
    <p style='margin-top:32px;color:#6B7280;font-size:13px;'>Markdown guides: <code>docs/getting-started.md</code> · <code>docs/authentication.md</code> · <code>docs/endpoints.md</code></p>
    </body></html>"""
    return HTMLResponse(html)
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
        "referrer_id": u.get("referrer_id"),
        "referrer_code": u.get("referrer_code"),
        "created_at": u.get("created_at"),
    }


async def get_wallet_balance(user_id: str) -> float:
    pipe = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]
    res = await db.transactions.aggregate(pipe).to_list(1)
    return float(res[0]["total"]) if res else 0.0


# ---------------- Push Notifications (Expo Push) ----------------
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def _send_expo_push(messages: list):
    """Best-effort POST to Expo push API. Silently logs failures so business logic isn't blocked."""
    if not messages:
        return
    try:
        async with httpx.AsyncClient(timeout=8.0) as client_http:
            await client_http.post(EXPO_PUSH_URL, json=messages, headers={
                "Accept": "application/json",
                "Accept-Encoding": "gzip, deflate",
                "Content-Type": "application/json",
            })
    except Exception as e:
        logger.warning("Expo push failed: %s", e)


async def push_to_user(user_id: str, title: str, body: str, data: Optional[dict] = None):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "push_token": 1})
    token = (user or {}).get("push_token")
    if not token or not token.startswith("ExponentPushToken"):
        return
    msg = {
        "to": token,
        "title": title,
        "body": body,
        "sound": "default",
        "priority": "high",
        "data": data or {},
    }
    await _send_expo_push([msg])


async def push_to_users(user_ids: list, title: str, body: str, data: Optional[dict] = None):
    if not user_ids:
        return
    users = await db.users.find({"id": {"$in": user_ids}, "push_token": {"$regex": "^ExponentPushToken"}}, {"_id": 0, "push_token": 1}).to_list(len(user_ids))
    msgs = [{"to": u["push_token"], "title": title, "body": body, "sound": "default", "priority": "high", "data": data or {}} for u in users]
    # Expo accepts up to 100 messages per request
    for i in range(0, len(msgs), 100):
        await _send_expo_push(msgs[i:i + 100])


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


def child_doc(parent_id: str, name: str, age: Optional[int], cls: Optional[str]) -> dict:
    cid = str(uuid.uuid4())
    return {
        "id": cid,
        "parent_id": parent_id,
        "name": name,
        "age": age,
        "child_class": cls,
        "child_id_code": "PPC-" + cid[:6].upper(),
        "enrollment_status": "pending",
        "created_at": now_iso(),
    }


# ---------------- Schemas ----------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str
    phone: Optional[str] = None
    child_name: str
    child_age: Optional[int] = None
    child_class: Optional[str] = None
    referrer_code: Optional[str] = None  # PPxxxxxx of an existing parent


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user: dict


class ChildIn(BaseModel):
    name: str
    age: Optional[int] = None
    child_class: Optional[str] = None


class UpiSettingsIn(BaseModel):
    upi_id: str
    qr_image_base64: Optional[str] = None
    fee_amount: Optional[float] = None
    instructions: Optional[str] = None


class CartItem(BaseModel):
    item_id: str
    qty: int = 1


class PaymentCreateIn(BaseModel):
    items: List[CartItem]
    child_id: Optional[str] = None
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


class AdminMessageIn(BaseModel):
    title: str
    body: str
    image_base64: Optional[str] = None
    recipient: Literal["all", "user"] = "all"
    user_id: Optional[str] = None


class AdminResetPasswordIn(BaseModel):
    new_password: Optional[str] = Field(default=None, min_length=6)


class ItemIn(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    item_type: Literal["course", "material", "merch", "other"] = "other"
    image_base64: Optional[str] = None
    active: bool = True
    commission: float = 0.0  # ₹ per unit credited to referrer when approved
    sample_url: Optional[str] = None
    sample_image_base64: Optional[str] = None
    coming_soon: bool = False  # If true, parents see badge & cannot add to cart


class VideoIn(BaseModel):
    title: str
    youtube_url: str
    description: Optional[str] = None
    child_class: Optional[str] = None  # "1".."10" or None for all
    active: bool = True


class WithdrawIn(BaseModel):
    amount: float = Field(gt=0)
    upi_id: Optional[str] = None
    note: Optional[str] = None


class WithdrawalDecisionIn(BaseModel):
    decision: Literal["approve", "reject", "paid"]
    admin_note: Optional[str] = None


class ReferralSettingsIn(BaseModel):
    registration_bonus: float = Field(ge=0)


class AttendanceIn(BaseModel):
    child_id: str
    date: str  # YYYY-MM-DD
    status: Literal["present", "absent", "leave"]
    note: Optional[str] = None


class FeedbackIn(BaseModel):
    type: Literal["rating", "suggestion"]
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    message: Optional[str] = None


class AdminFeedbackReplyIn(BaseModel):
    admin_reply: str = Field(min_length=1, max_length=2000)


class PushTokenIn(BaseModel):
    push_token: str = Field(min_length=4, max_length=400)
    platform: Optional[str] = None  # "ios" | "android" | "web"


# ---------------- Auth ----------------
@api_router.post("/auth/register", response_model=TokenOut, tags=["Authentication"])
async def register(body: RegisterIn):
    email = body.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    referrer = None
    if body.referrer_code:
        code = body.referrer_code.strip().upper()
        referrer = await db.users.find_one({"user_id_code": code, "role": "parent"}, {"_id": 0})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")

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
        "referrer_id": referrer["id"] if referrer else None,
        "referrer_code": referrer["user_id_code"] if referrer else None,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    # auto-create the first child record
    await db.children.insert_one(child_doc(user_id, body.child_name, body.child_age, body.child_class))
    # send a welcome message to inbox so the parent can always refer back to credentials
    welcome_text = (
        f"Welcome to Pragati Path! Your account has been created.\n\n"
        f"User ID: {user_id_code}\n"
        f"Email: {email}\n"
        f"Password: {body.password}\n\n"
        f"Please save these credentials securely. Pragati Path is designed for Winners — "
        f"every child is a winner!"
    )
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": "🎉 Account Created",
        "body": welcome_text,
        "type": "enrollment",
        "image_base64": None,
        "read": False,
        "created_at": now_iso(),
    })

    # Referral bonus + congrats notification
    if referrer:
        settings = await db.settings.find_one({"id": "referral"}, {"_id": 0}) or {}
        bonus = float(settings.get("registration_bonus", 0) or 0)
        if bonus > 0:
            await db.transactions.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": referrer["id"],
                "type": "register_bonus",
                "amount": bonus,
                "ref_user_id": user_id,
                "ref_user_name": body.name,
                "note": f"Sign-up bonus for {body.name}",
                "status": "credited",
                "created_at": now_iso(),
            })
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": referrer["id"],
            "title": "🎊 New Referral Joined!",
            "body": (
                f"Congratulations! {body.name} has joined Pragati Path using your referral code "
                f"{user_id_code if False else referrer['user_id_code']}. "
                + (f"₹{bonus:.0f} sign-up bonus credited to your wallet." if bonus > 0 else "You'll earn commission when their first course payment is approved.")
            ),
            "type": "referral",
            "image_base64": None,
            "read": False,
            "created_at": now_iso(),
        })

    token = create_token(user_id, email, "parent")
    return {"token": token, "user": clean_user(doc)}


@api_router.post("/auth/login", response_model=TokenOut, tags=["Authentication"])
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["id"], email, user.get("role", "parent"))
    return {"token": token, "user": clean_user(user)}


@api_router.get("/auth/me", tags=["Authentication"])
async def me(user: dict = Depends(get_current_user)):
    return clean_user(user)


# ---------------- Children ----------------
@api_router.get("/children/me", tags=["Children"])
async def my_children(user: dict = Depends(get_current_user)):
    items = await db.children.find({"parent_id": user["id"]}, {"_id": 0}).sort("created_at", 1).to_list(100)
    return items


@api_router.post("/children", tags=["Children"])
async def add_child(body: ChildIn, user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admins do not have children records")
    doc = child_doc(user["id"], body.name, body.age, body.child_class)
    await db.children.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/children/{child_id}", tags=["Children"])
async def update_child(child_id: str, body: ChildIn, user: dict = Depends(get_current_user)):
    res = await db.children.update_one(
        {"id": child_id, "parent_id": user["id"]},
        {"$set": {"name": body.name, "age": body.age, "child_class": body.child_class}},
    )
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Child not found")
    return await db.children.find_one({"id": child_id}, {"_id": 0})


@api_router.delete("/children/{child_id}", tags=["Children"])
async def delete_child(child_id: str, user: dict = Depends(get_current_user)):
    res = await db.children.delete_one({"id": child_id, "parent_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Child not found")
    return {"ok": True}


@api_router.get("/admin/children", tags=["Admin · Users"])
async def all_children(admin: dict = Depends(require_admin)):
    items = await db.children.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


# ---------------- UPI Settings ----------------
@api_router.get("/upi-settings", tags=["Public"])
async def get_upi(user: dict = Depends(get_current_user)):
    settings = await db.upi_settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        return {"upi_id": "", "qr_image_base64": "", "fee_amount": 0, "instructions": ""}
    return settings


@api_router.put("/admin/upi-settings", tags=["Admin · Settings"])
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


# ---------------- Items Catalog ----------------
@api_router.get("/items", tags=["Shop"])
async def list_active_items(user: dict = Depends(get_current_user)):
    items = await db.items.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.get("/admin/items", tags=["Admin · Shop"])
async def all_items(admin: dict = Depends(require_admin)):
    items = await db.items.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.post("/admin/items", tags=["Admin · Shop"])
async def create_item(body: ItemIn, admin: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_iso()}
    await db.items.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/items/{item_id}", tags=["Admin · Shop"])
async def update_item(item_id: str, body: ItemIn, admin: dict = Depends(require_admin)):
    res = await db.items.update_one({"id": item_id}, {"$set": body.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return await db.items.find_one({"id": item_id}, {"_id": 0})


@api_router.delete("/admin/items/{item_id}", tags=["Admin · Shop"])
async def delete_item(item_id: str, admin: dict = Depends(require_admin)):
    res = await db.items.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ---------------- Payments ----------------
@api_router.post("/payments", tags=["Payments"])
async def create_payment(body: PaymentCreateIn, user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admins cannot create payments")
    if not body.items:
        raise HTTPException(status_code=400, detail="At least one item required")
    # validate child belongs to parent (if provided)
    child = None
    if body.child_id:
        child = await db.children.find_one({"id": body.child_id, "parent_id": user["id"]}, {"_id": 0})
        if not child:
            raise HTTPException(status_code=400, detail="Invalid child")
    # build line items + total from current catalog prices (batch fetch)
    lines = []
    total = 0.0
    has_course = False
    item_ids = list({ci.item_id for ci in body.items})
    found = await db.items.find({"id": {"$in": item_ids}, "active": True}, {"_id": 0}).to_list(len(item_ids))
    by_id = {it["id"]: it for it in found}
    for ci in body.items:
        it = by_id.get(ci.item_id)
        if not it:
            raise HTTPException(status_code=400, detail=f"Item {ci.item_id} not available")
        if it.get("coming_soon"):
            raise HTTPException(status_code=400, detail=f"'{it.get('name')}' is coming soon and cannot be purchased yet")
        qty = max(1, int(ci.qty))
        line_total = float(it["price"]) * qty
        total += line_total
        if it.get("item_type") == "course":
            has_course = True
        lines.append({
            "item_id": it["id"],
            "name": it["name"],
            "price": float(it["price"]),
            "item_type": it.get("item_type", "other"),
            "qty": qty,
            "line_total": line_total,
        })
    pid = str(uuid.uuid4())
    doc = {
        "id": pid,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user.get("name"),
        "child_id": body.child_id,
        "child_name": child["name"] if child else None,
        "items": lines,
        "amount": total,
        "has_course": has_course,
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


@api_router.get("/payments/me", tags=["Payments"])
async def my_payments(user: dict = Depends(get_current_user)):
    items = await db.payments.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/payments/{payment_id}", tags=["Payments"])
async def payment_detail(payment_id: str, user: dict = Depends(get_current_user)):
    p = await db.payments.find_one({"id": payment_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    if user.get("role") != "admin" and p["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    return p


@api_router.get("/admin/payments", tags=["Admin · Payments"])
async def all_payments(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status:
        q["status"] = status
    items = await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/admin/payments/{payment_id}/decide", tags=["Admin · Payments"])
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
    if not user:
        return await db.payments.find_one({"id": payment_id}, {"_id": 0})

    if new_status == "approved":
        # credit per-item commission to referrer (if any)
        if user.get("referrer_id") and payment.get("items"):
            comm_total = 0.0
            for it in payment["items"]:
                # fetch latest commission from items collection (fallback 0)
                cat = await db.items.find_one({"id": it.get("item_id")}, {"_id": 0, "commission": 1})
                comm_unit = float((cat or {}).get("commission", 0) or 0)
                if comm_unit > 0:
                    comm_line = comm_unit * int(it.get("qty", 1))
                    comm_total += comm_line
                    await db.transactions.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": user["referrer_id"],
                        "type": "item_commission",
                        "amount": comm_line,
                        "ref_user_id": user["id"],
                        "ref_user_name": user.get("name"),
                        "payment_id": payment["id"],
                        "item_id": it.get("item_id"),
                        "item_name": it.get("name"),
                        "qty": int(it.get("qty", 1)),
                        "note": f"Commission for {it.get('name')} × {it.get('qty', 1)}",
                        "status": "credited",
                        "created_at": now_iso(),
                    })
            if comm_total > 0:
                await db.notifications.insert_one({
                    "id": str(uuid.uuid4()),
                    "user_id": user["referrer_id"],
                    "title": "💰 Commission Credited",
                    "body": f"₹{comm_total:.0f} commission credited from {user.get('name')}'s purchase.",
                    "type": "wallet",
                    "image_base64": None,
                    "read": False,
                    "created_at": now_iso(),
                })

        # if course item present and child linked, mark child enrolled
        if payment.get("has_course") and payment.get("child_id"):
            await db.children.update_one(
                {"id": payment["child_id"], "parent_id": user["id"]},
                {"$set": {"enrollment_status": "enrolled"}},
            )
            # if first time enrolling any child, generate creds & send template msg
            already_enrolled_count = await db.children.count_documents({
                "parent_id": user["id"], "enrollment_status": "enrolled",
            })
            if user.get("enrollment_status") != "enrolled":
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
                    "title": "Welcome to Pragati Path",
                    "body": text,
                    "type": "enrollment",
                    "read": False,
                    "created_at": now_iso(),
                })
            child = await db.children.find_one({"id": payment["child_id"]}, {"_id": 0})
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": "Child Enrolled",
                "body": f"Your child {child['name'] if child else ''} is successfully enrolled with Pragati Path.",
                "type": "info",
                "read": False,
                "created_at": now_iso(),
            })
        else:
            # no course → just a payment-received notification
            await db.notifications.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "title": "Payment Approved",
                "body": f"Your payment of ₹{payment['amount']} has been received. Thank you!",
                "type": "payment",
                "read": False,
                "created_at": now_iso(),
            })
        # Push the good news
        await push_to_user(user["id"], "Payment Approved ✅", f"₹{payment['amount']} received. Thank you!", {"type": "payment", "payment_id": payment_id})
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
        await push_to_user(user["id"], "Payment Rejected", body.admin_note or "Please contact admin.", {"type": "payment", "payment_id": payment_id})

    return await db.payments.find_one({"id": payment_id}, {"_id": 0})


# ---------------- Advertisements ----------------
@api_router.get("/ads", tags=["Public"])
async def list_active_ads(user: dict = Depends(get_current_user)):
    items = await db.ads.find({"active": True}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api_router.get("/admin/ads", tags=["Admin · Ads"])
async def all_ads(admin: dict = Depends(require_admin)):
    items = await db.ads.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.post("/admin/ads", tags=["Admin · Ads"])
async def create_ad(body: AdIn, admin: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_iso()}
    await db.ads.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/ads/{ad_id}", tags=["Admin · Ads"])
async def update_ad(ad_id: str, body: AdIn, admin: dict = Depends(require_admin)):
    res = await db.ads.update_one({"id": ad_id}, {"$set": body.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return await db.ads.find_one({"id": ad_id}, {"_id": 0})


@api_router.delete("/admin/ads/{ad_id}", tags=["Admin · Ads"])
async def delete_ad(ad_id: str, admin: dict = Depends(require_admin)):
    res = await db.ads.delete_one({"id": ad_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Ad not found")
    return {"ok": True}


# ---------------- Notifications ----------------
@api_router.get("/notifications/me", tags=["Notifications"])
async def my_notifications(user: dict = Depends(get_current_user)):
    items = await db.notifications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.post("/notifications/{notif_id}/read", tags=["Notifications"])
async def read_notif(notif_id: str, user: dict = Depends(get_current_user)):
    await db.notifications.update_one(
        {"id": notif_id, "user_id": user["id"]}, {"$set": {"read": True}}
    )
    return {"ok": True}


@api_router.post("/admin/notifications", tags=["Admin · Messaging"])
async def admin_send(body: AdminMessageIn, admin: dict = Depends(require_admin)):
    if body.recipient == "user":
        if not body.user_id:
            raise HTTPException(status_code=400, detail="user_id required for user recipient")
        target = await db.users.find_one({"id": body.user_id, "role": "parent"}, {"_id": 0})
        if not target:
            raise HTTPException(status_code=404, detail="Parent not found")
        target_ids = [body.user_id]
    else:
        parents = await db.users.find({"role": "parent"}, {"_id": 0, "id": 1}).to_list(10000)
        target_ids = [p["id"] for p in parents]
    if not target_ids:
        return {"sent": 0}
    docs = [{
        "id": str(uuid.uuid4()),
        "user_id": uid,
        "title": body.title,
        "body": body.body,
        "image_base64": body.image_base64,
        "type": "admin",
        "read": False,
        "created_at": now_iso(),
    } for uid in target_ids]
    await db.notifications.insert_many(docs)
    # Fire-and-forget push notifications
    await push_to_users(target_ids, body.title, body.body[:280], {"type": "admin"})
    return {"sent": len(target_ids)}


# ---------------- Attendance ----------------
@api_router.post("/admin/attendance", tags=["Admin · Attendance"])
async def mark_attendance(body: AttendanceIn, admin: dict = Depends(require_admin)):
    # Upsert one record per (child_id, date)
    child = await db.children.find_one({"id": body.child_id}, {"_id": 0})
    if not child:
        raise HTTPException(status_code=404, detail="Child not found")
    update = {
        "child_id": body.child_id,
        "parent_id": child["parent_id"],
        "child_name": child["name"],
        "date": body.date,
        "status": body.status,
        "note": body.note,
        "marked_by": admin["id"],
        "marked_at": now_iso(),
    }
    await db.attendance.update_one(
        {"child_id": body.child_id, "date": body.date},
        {"$set": update, "$setOnInsert": {"id": str(uuid.uuid4())}},
        upsert=True,
    )
    rec = await db.attendance.find_one({"child_id": body.child_id, "date": body.date}, {"_id": 0})
    return rec


@api_router.get("/admin/attendance", tags=["Admin · Attendance"])
async def list_attendance(child_id: Optional[str] = None, date_from: Optional[str] = None, date_to: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if child_id: q["child_id"] = child_id
    if date_from or date_to:
        d = {}
        if date_from: d["$gte"] = date_from
        if date_to: d["$lte"] = date_to
        q["date"] = d
    items = await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(2000)
    return items


@api_router.get("/attendance/me", tags=["Attendance"])
async def my_attendance(child_id: str, date_from: Optional[str] = None, date_to: Optional[str] = None, user: dict = Depends(get_current_user)):
    # ensure child belongs to user
    if user.get("role") != "admin":
        own = await db.children.find_one({"id": child_id, "parent_id": user["id"]})
        if not own:
            raise HTTPException(status_code=403, detail="Not your child")
    q = {"child_id": child_id}
    if date_from or date_to:
        d = {}
        if date_from: d["$gte"] = date_from
        if date_to: d["$lte"] = date_to
        q["date"] = d
    items = await db.attendance.find(q, {"_id": 0}).sort("date", -1).to_list(500)
    return items


# ---------------- Admin: Users + Template + Stats ----------------
@api_router.get("/admin/users", tags=["Admin · Users"])
async def list_users(admin: dict = Depends(require_admin)):
    items = await db.users.find({"role": {"$ne": "admin"}}, {"_id": 0, "password_hash": 0, "issued_password": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/admin/users/{user_id}/reset-password", tags=["Admin · Users"])
async def admin_reset_password(user_id: str, body: AdminResetPasswordIn, admin: dict = Depends(require_admin)):
    target = await db.users.find_one({"id": user_id, "role": "parent"}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Parent not found")
    new_password = body.new_password or uuid.uuid4().hex[:8]
    await db.users.update_one(
        {"id": user_id},
        {"$set": {"password_hash": hash_password(new_password), "issued_password": new_password}},
    )
    user_id_code = target.get("user_id_code") or user_id[:8]
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "title": "🔐 Password Reset",
        "body": (
            f"Your password has been reset by the admin.\n\n"
            f"User ID: {user_id_code}\n"
            f"Email: {target['email']}\n"
            f"New Password: {new_password}\n\n"
            f"Please sign in with the new password and save it securely."
        ),
        "type": "admin",
        "image_base64": None,
        "read": False,
        "created_at": now_iso(),
    })
    return {"ok": True, "user_id": user_id, "user_id_code": user_id_code, "email": target["email"], "new_password": new_password}


@api_router.get("/admin/template", tags=["Admin · Settings"])
async def get_template(admin: dict = Depends(require_admin)):
    tpl_doc = await db.settings.find_one({"id": "auto_message"}, {"_id": 0})
    return {"template": tpl_doc.get("template") if tpl_doc else DEFAULT_TEMPLATE}


@api_router.put("/admin/template", tags=["Admin · Settings"])
async def update_template(body: TemplateIn, admin: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"id": "auto_message"},
        {"$set": {"template": body.template, "updated_at": now_iso()}, "$setOnInsert": {"id": "auto_message"}},
        upsert=True,
    )
    return {"template": body.template}


@api_router.get("/admin/stats", tags=["Admin · Dashboard"])
async def admin_stats(admin: dict = Depends(require_admin)):
    pending = await db.payments.count_documents({"status": "pending"})
    approved = await db.payments.count_documents({"status": "approved"})
    users = await db.users.count_documents({"role": {"$ne": "admin"}})
    children = await db.children.count_documents({})
    enrolled = await db.children.count_documents({"enrollment_status": "enrolled"})
    ads = await db.ads.count_documents({"active": True})
    items = await db.items.count_documents({"active": True})
    wd = await db.withdrawals.count_documents({"status": "requested"})
    return {
        "pending_payments": pending,
        "approved_payments": approved,
        "total_users": users,
        "total_children": children,
        "enrolled_children": enrolled,
        "active_ads": ads,
        "active_items": items,
        "pending_withdrawals": wd,
    }


# ---------------- Videos / Classes ----------------
@api_router.get("/videos", tags=["Videos"])
async def list_videos(child_class: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"active": True}
    if child_class:
        q["$or"] = [{"child_class": child_class}, {"child_class": None}, {"child_class": ""}]
    items = await db.videos.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.get("/admin/videos", tags=["Admin · Videos"])
async def all_videos(admin: dict = Depends(require_admin)):
    items = await db.videos.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items


@api_router.post("/admin/videos", tags=["Admin · Videos"])
async def create_video(body: VideoIn, admin: dict = Depends(require_admin)):
    doc = {"id": str(uuid.uuid4()), **body.dict(), "created_at": now_iso()}
    await db.videos.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/admin/videos/{video_id}", tags=["Admin · Videos"])
async def update_video(video_id: str, body: VideoIn, admin: dict = Depends(require_admin)):
    res = await db.videos.update_one({"id": video_id}, {"$set": body.dict()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return await db.videos.find_one({"id": video_id}, {"_id": 0})


@api_router.delete("/admin/videos/{video_id}", tags=["Admin · Videos"])
async def delete_video(video_id: str, admin: dict = Depends(require_admin)):
    res = await db.videos.delete_one({"id": video_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Video not found")
    return {"ok": True}


# ---------------- Wallet & Referrals ----------------
@api_router.get("/wallet/me", tags=["Wallet"])
async def my_wallet(user: dict = Depends(get_current_user)):
    txns = await db.transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    balance = sum(float(t.get("amount", 0)) for t in txns)
    referral_count = await db.users.count_documents({"referrer_id": user["id"]})
    settings = await db.settings.find_one({"id": "referral"}, {"_id": 0}) or {}
    return {
        "balance": balance,
        "transactions": txns,
        "referral_count": referral_count,
        "user_id_code": user.get("user_id_code"),
        "registration_bonus": float(settings.get("registration_bonus", 0) or 0),
    }


@api_router.post("/wallet/withdraw", tags=["Wallet"])
async def request_withdraw(body: WithdrawIn, user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admins cannot withdraw")
    balance = await get_wallet_balance(user["id"])
    if body.amount > balance:
        raise HTTPException(status_code=400, detail=f"Insufficient balance (₹{balance:.0f})")
    wid = str(uuid.uuid4())
    doc = {
        "id": wid,
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user["email"],
        "amount": body.amount,
        "upi_id": body.upi_id,
        "note": body.note,
        "status": "requested",
        "admin_note": None,
        "created_at": now_iso(),
        "decided_at": None,
    }
    await db.withdrawals.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/wallet/withdrawals/me", tags=["Wallet"])
async def my_withdrawals(user: dict = Depends(get_current_user)):
    items = await db.withdrawals.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/admin/withdrawals", tags=["Admin · Wallet"])
async def admin_withdrawals(status: Optional[str] = None, admin: dict = Depends(require_admin)):
    q = {}
    if status: q["status"] = status
    items = await db.withdrawals.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.post("/admin/withdrawals/{wid}/decide", tags=["Admin · Wallet"])
async def decide_withdrawal(wid: str, body: WithdrawalDecisionIn, admin: dict = Depends(require_admin)):
    w = await db.withdrawals.find_one({"id": wid}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Withdrawal not found")
    if w["status"] not in ("requested", "approved"):
        raise HTTPException(status_code=400, detail="Cannot change status")
    new_status = {"approve": "approved", "reject": "rejected", "paid": "paid"}[body.decision]
    update = {"status": new_status, "admin_note": body.admin_note, "decided_at": now_iso()}
    await db.withdrawals.update_one({"id": wid}, {"$set": update})
    if new_status == "paid":
        # debit the wallet — negative txn
        await db.transactions.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": w["user_id"],
            "type": "withdrawal_paid",
            "amount": -float(w["amount"]),
            "withdrawal_id": wid,
            "note": f"Withdrawal ₹{float(w['amount']):.0f} paid",
            "status": "debited",
            "created_at": now_iso(),
        })
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": w["user_id"],
            "title": "✅ Withdrawal Paid",
            "body": f"₹{float(w['amount']):.0f} has been paid out. {body.admin_note or ''}".strip(),
            "type": "wallet",
            "image_base64": None,
            "read": False,
            "created_at": now_iso(),
        })
    elif new_status == "rejected":
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": w["user_id"],
            "title": "Withdrawal Rejected",
            "body": f"Your withdrawal request was rejected. {body.admin_note or ''}".strip(),
            "type": "wallet",
            "image_base64": None,
            "read": False,
            "created_at": now_iso(),
        })
    return await db.withdrawals.find_one({"id": wid}, {"_id": 0})


@api_router.get("/admin/referral-settings", tags=["Admin · Referrals"])
async def get_ref_settings(admin: dict = Depends(require_admin)):
    s = await db.settings.find_one({"id": "referral"}, {"_id": 0}) or {}
    return {"registration_bonus": float(s.get("registration_bonus", 0) or 0)}


@api_router.put("/admin/referral-settings", tags=["Admin · Referrals"])
async def put_ref_settings(body: ReferralSettingsIn, admin: dict = Depends(require_admin)):
    await db.settings.update_one(
        {"id": "referral"},
        {"$set": {"registration_bonus": body.registration_bonus, "updated_at": now_iso()}, "$setOnInsert": {"id": "referral"}},
        upsert=True,
    )
    return {"registration_bonus": body.registration_bonus}


@api_router.get("/admin/referrals", tags=["Admin · Referrals"])
async def admin_referrals(admin: dict = Depends(require_admin)):
    """List all referral relationships."""
    pipe = [
        {"$match": {"role": "parent", "referrer_id": {"$ne": None}}},
        {"$project": {"_id": 0, "id": 1, "name": 1, "email": 1, "user_id_code": 1, "child_name": 1, "referrer_id": 1, "referrer_code": 1, "enrollment_status": 1, "created_at": 1}},
        {"$sort": {"created_at": -1}},
    ]
    items = await db.users.aggregate(pipe).to_list(1000)
    return items


# ---------------- Feedback / Suggestions ----------------
@api_router.post("/feedback", tags=["Feedback"])
async def submit_feedback(body: FeedbackIn, user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        raise HTTPException(status_code=400, detail="Admins cannot submit feedback")
    if body.type == "rating":
        if not body.rating:
            raise HTTPException(status_code=400, detail="Rating is required")
        # ensure idempotent: replace existing rating for the user
        existing = await db.feedbacks.find_one({"user_id": user["id"], "type": "rating"})
        doc = {
            "id": existing["id"] if existing else str(uuid.uuid4()),
            "user_id": user["id"],
            "user_name": user.get("name"),
            "user_email": user.get("email"),
            "type": "rating",
            "rating": int(body.rating),
            "message": (body.message or "").strip() or None,
            "created_at": now_iso(),
        }
        if existing:
            await db.feedbacks.update_one({"id": existing["id"]}, {"$set": doc})
        else:
            await db.feedbacks.insert_one(doc)
        return {"ok": True, "id": doc["id"]}
    # suggestion
    if not (body.message and body.message.strip()):
        raise HTTPException(status_code=400, detail="Message is required for suggestion")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "user_name": user.get("name"),
        "user_email": user.get("email"),
        "type": "suggestion",
        "rating": None,
        "message": body.message.strip(),
        "created_at": now_iso(),
    }
    await db.feedbacks.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@api_router.get("/feedback/me/rated", tags=["Feedback"])
async def has_rated(user: dict = Depends(get_current_user)):
    existing = await db.feedbacks.find_one({"user_id": user["id"], "type": "rating"}, {"_id": 0, "rating": 1, "created_at": 1})
    return {"rated": bool(existing), "rating": existing.get("rating") if existing else None}


@api_router.get("/feedback/me/engaged", tags=["Feedback"])
async def has_engaged(user: dict = Depends(get_current_user)):
    """Returns True if the user has submitted ANY feedback (rating or suggestion).
    Used by the rating popup so we don't pester users who already gave feedback."""
    any_doc = await db.feedbacks.find_one({"user_id": user["id"]}, {"_id": 0, "type": 1})
    return {"engaged": bool(any_doc)}


@api_router.get("/feedback/me", tags=["Feedback"])
async def my_feedback(user: dict = Depends(get_current_user)):
    items = await db.feedbacks.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return items


@api_router.get("/admin/feedback", tags=["Admin · Feedback"])
async def admin_feedback(
    type: Optional[str] = None,
    admin: dict = Depends(require_admin),
):
    q: dict = {}
    if type in ("rating", "suggestion"):
        q["type"] = type
    items = await db.feedbacks.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # aggregate average rating
    avg = None
    count_rating = 0
    if not type or type == "rating":
        ratings = [it["rating"] for it in items if it.get("type") == "rating" and it.get("rating")]
        if ratings:
            avg = round(sum(ratings) / len(ratings), 2)
            count_rating = len(ratings)
    return {"items": items, "avg_rating": avg, "rating_count": count_rating}


@api_router.post("/admin/feedback/{feedback_id}/reply", tags=["Admin · Feedback"])
async def reply_to_feedback(feedback_id: str, body: AdminFeedbackReplyIn, admin: dict = Depends(require_admin)):
    fb = await db.feedbacks.find_one({"id": feedback_id}, {"_id": 0})
    if not fb:
        raise HTTPException(status_code=404, detail="Feedback not found")
    reply_at = now_iso()
    await db.feedbacks.update_one(
        {"id": feedback_id},
        {"$set": {"admin_reply": body.admin_reply.strip(), "admin_reply_at": reply_at}},
    )
    # Notification + push
    user_id = fb.get("user_id")
    if user_id:
        title = "Reply to your feedback"
        msg_body = body.admin_reply.strip()[:280]
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "title": title,
            "body": msg_body,
            "image_base64": None,
            "type": "feedback_reply",
            "read": False,
            "created_at": reply_at,
        })
        await push_to_user(user_id, title, msg_body, {"type": "feedback_reply", "feedback_id": feedback_id})
    updated = await db.feedbacks.find_one({"id": feedback_id}, {"_id": 0})
    return updated


# ---------------- Push Notification Tokens ----------------
@api_router.post("/users/me/push-token", tags=["Push Notifications"])
async def save_push_token(body: PushTokenIn, user: dict = Depends(get_current_user)):
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"push_token": body.push_token, "push_platform": body.platform, "push_token_updated_at": now_iso()}},
    )
    return {"ok": True}


@api_router.delete("/users/me/push-token", tags=["Push Notifications"])
async def remove_push_token(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$unset": {"push_token": "", "push_platform": ""}})
    return {"ok": True}


@api_router.get("/", tags=["Public"])
async def root():
    return {"message": "Pragati Path API", "ok": True}


# ---------------- Startup ----------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.payments.create_index("user_id")
    await db.notifications.create_index("user_id")
    await db.children.create_index("parent_id")
    await db.attendance.create_index([("child_id", 1), ("date", 1)], unique=True)
    await db.transactions.create_index("user_id")
    await db.users.create_index("user_id_code")
    await db.users.create_index("referrer_id")
    await db.feedbacks.create_index([("user_id", 1), ("type", 1)])
    await db.feedbacks.create_index("created_at")

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
        if not verify_password(admin_password, existing.get("password_hash", "")):
            await db.users.update_one(
                {"email": admin_email},
                {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}},
            )

    if not await db.settings.find_one({"id": "auto_message"}):
        await db.settings.insert_one({"id": "auto_message", "template": DEFAULT_TEMPLATE})

    if not await db.upi_settings.find_one({"id": "default"}):
        await db.upi_settings.insert_one({
            "id": "default",
            "upi_id": "pragatipath@upi",
            "qr_image_base64": "",
            "fee_amount": 5000.0,
            "instructions": "Pay using any UPI app, then upload the screenshot or enter the UTR/Transaction ID.",
        })

    if not await db.settings.find_one({"id": "referral"}):
        await db.settings.insert_one({"id": "referral", "registration_bonus": 200.0})

    if await db.videos.count_documents({}) == 0:
        await db.videos.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Welcome to Pragati Path Classes",
            "youtube_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "description": "Sample intro video. Replace with real class videos from the admin panel.",
            "child_class": None,
            "active": True,
            "created_at": now_iso(),
        })

    if await db.ads.count_documents({}) == 0:
        await db.ads.insert_one({
            "id": str(uuid.uuid4()),
            "title": "Welcome to Pragati Path",
            "body": "Designed for Winners — every child is a winner. New batch admissions open!",
            "image_base64": "",
            "active": True,
            "created_at": now_iso(),
        })

    # seed default catalog items if empty
    if await db.items.count_documents({}) == 0:
        seed_items = [
            {"name": "Foundation Course (Class 1-5)", "description": "Full year coaching, all subjects", "price": 12000, "item_type": "course"},
            {"name": "Excellence Course (Class 6-10)", "description": "Full year coaching, all subjects", "price": 18000, "item_type": "course"},
            {"name": "Olympiad Booster", "description": "Maths & Science Olympiad prep", "price": 6000, "item_type": "course"},
            {"name": "Study Material Pack", "description": "Printed notes + workbooks", "price": 1500, "item_type": "material"},
            {"name": "Sample Paper Set", "description": "Practice papers with solutions", "price": 600, "item_type": "material"},
            {"name": "Pragati Path T-Shirt", "description": "Official school T-shirt", "price": 450, "item_type": "merch"},
        ]
        for s in seed_items:
            await db.items.insert_one({"id": str(uuid.uuid4()), **s, "active": True, "image_base64": "", "created_at": now_iso()})

    # migrate: ensure each parent without a children record gets one created from legacy fields (batched)
    parent_users = await db.users.find({"role": "parent"}, {"_id": 0}).to_list(10000)
    if parent_users:
        parent_ids = [u["id"] for u in parent_users]
        existing = await db.children.find(
            {"parent_id": {"$in": parent_ids}}, {"_id": 0, "parent_id": 1}
        ).to_list(len(parent_ids) * 5)
        have_child = {c["parent_id"] for c in existing}
        docs_to_insert = []
        for u in parent_users:
            if u["id"] in have_child:
                continue
            if not u.get("child_name"):
                continue
            doc = child_doc(u["id"], u["child_name"], u.get("child_age"), u.get("child_class"))
            if u.get("enrollment_status") == "enrolled":
                doc["enrollment_status"] = "enrolled"
            docs_to_insert.append(doc)
        if docs_to_insert:
            await db.children.insert_many(docs_to_insert)


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
