from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import base64
from bson import ObjectId
import random
import string

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET_KEY = os.environ.get('SECRET_KEY', 'lifeline-mlm-portal-secret-key')
ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Life Line's MLM Work Portal")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# MLM Models
class MLMUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    mobile_number: str
    full_name: str
    upi_address: str
    referral_code: str
    referred_by: Optional[str] = None  # referral_code of referrer
    role: str = "member"  # "admin" or "member"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    registration_fee_paid: bool = False
    
    # Registration fee installments
    registration_installments: List[float] = []  # amounts paid in installments
    total_installments_paid: float = 0.0
    can_work: bool = False  # True after first installment
    
    # Financial tracking
    total_earnings: float = 0.0
    pending_earnings: float = 0.0
    credited_earnings: float = 0.0
    total_withdrawn: float = 0.0
    current_balance: float = 0.0
    
    # MLM specific
    direct_referrals: List[str] = []  # list of user IDs
    total_referrals: int = 0
    can_withdraw: bool = False  # True when has 5+ direct referrals
    level: int = 1

class MLMUserCreate(BaseModel):
    mobile_number: str
    full_name: str
    upi_address: str
    password: str
    referred_by_code: Optional[str] = None

class MLMLogin(BaseModel):
    mobile_number: str
    password: str

class MLMWorkAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    amount: float
    attachment_name: Optional[str] = None
    attachment_data: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str  # admin user id
    deadline: datetime
    is_active: bool = True

class MLMWorkSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    user_id: str
    submission_file_name: Optional[str] = None
    submission_file_data: Optional[str] = None
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"  # "pending", "approved", "rejected"
    admin_comments: Optional[str] = None
    reviewed_at: Optional[datetime] = None

class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    type: str  # "earning", "commission", "withdrawal", "registration_fee"
    amount: float
    description: str
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "completed"  # "pending", "completed", "rejected"
    reference_id: Optional[str] = None  # assignment_id, withdrawal_id, etc.

class WithdrawalRequest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount: float
    upi_address: str
    requested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"  # "pending", "approved", "paid", "rejected"
    processed_at: Optional[datetime] = None
    processed_by: Optional[str] = None
    admin_comments: Optional[str] = None

class DailyWorkReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str  # YYYY-MM-DD format
    class_name: str
    subject: str
    details: str
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class InstallmentPayment(BaseModel):
    user_id: str
    installment_number: int  # 1-10
    amount: float

class MLMSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    registration_fee: float = 500.0
    minimum_withdrawal: float = 100.0
    admin_upi: str = "admin@upi"  # Admin UPI for registration payments
    commission_l1: float = 5.0  # percentage
    commission_l2: float = 3.0
    commission_l3: float = 1.0
    commission_l4: float = 1.0
    commission_l5: float = 1.0
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: str

# Helper functions
def prepare_for_mongo(data):
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    if isinstance(item, dict):
        if '_id' in item:
            del item['_id']
            
        for key, value in item.items():
            if isinstance(value, str) and (key.endswith('_at') or key.endswith('_time')):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
            elif key in ['deadline', 'date'] and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
    return item

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def generate_referral_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.mlm_users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return MLMUser(**parse_from_mongo(user))
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def calculate_and_distribute_commissions(user_id: str, earning_amount: float):
    """Calculate and distribute commissions up the referral chain"""
    settings = await get_mlm_settings()
    commission_rates = {
        1: settings.commission_l1 / 100,
        2: settings.commission_l2 / 100, 
        3: settings.commission_l3 / 100,
        4: settings.commission_l4 / 100,
        5: settings.commission_l5 / 100
    }
    
    current_user = await db.mlm_users.find_one({"id": user_id})
    if not current_user:
        return
    
    referrer_code = current_user.get("referred_by")
    level = 1
    
    while referrer_code and level <= 5:
        referrer = await db.mlm_users.find_one({"referral_code": referrer_code})
        if not referrer:
            break
            
        commission_rate = commission_rates.get(level, 0)
        if commission_rate > 0:
            commission_amount = earning_amount * commission_rate
            
            # Update referrer's earnings
            await db.mlm_users.update_one(
                {"id": referrer["id"]},
                {"$inc": {
                    "current_balance": commission_amount,
                    "total_earnings": commission_amount
                }}
            )
            
            # Record transaction
            transaction = Transaction(
                user_id=referrer["id"],
                type="commission",
                amount=commission_amount,
                description=f"Level {level} commission from {current_user['full_name']}",
                reference_id=user_id
            )
            await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
        
        referrer_code = referrer.get("referred_by")
        level += 1

async def update_referral_eligibility(user_id: str):
    """Check and update withdrawal eligibility based on direct referrals"""
    user = await db.mlm_users.find_one({"id": user_id})
    if not user:
        return
    
    direct_referrals_count = len(user.get("direct_referrals", []))
    can_withdraw = direct_referrals_count >= 5
    
    await db.mlm_users.update_one(
        {"id": user_id},
        {"$set": {"can_withdraw": can_withdraw}}
    )

async def get_mlm_settings():
    """Get MLM settings or create default"""
    settings = await db.mlm_settings.find_one({})
    if not settings:
        default_settings = MLMSettings(updated_by="system")
        await db.mlm_settings.insert_one(prepare_for_mongo(default_settings.dict()))
        return default_settings
    return MLMSettings(**parse_from_mongo(settings))

# Routes
@api_router.get("/")
async def root():
    return {"message": "Life Line's MLM Work Portal API"}

@api_router.post("/auth/register")
async def register_user(user_data: MLMUserCreate):
    # Check if mobile number already exists
    existing = await db.mlm_users.find_one({"mobile_number": user_data.mobile_number})
    if existing:
        raise HTTPException(status_code=400, detail="Mobile number already registered")
    
    # Validate referral code if provided
    referrer = None
    if user_data.referred_by_code:
        referrer = await db.mlm_users.find_one({"referral_code": user_data.referred_by_code})
        if not referrer:
            raise HTTPException(status_code=400, detail="Invalid referral code")
        
        # Prevent self-referral - user cannot refer themselves
        if referrer["mobile_number"] == user_data.mobile_number:
            raise HTTPException(status_code=400, detail="You cannot use your own referral code")
    
    # Create user
    hashed_password = get_password_hash(user_data.password)
    referral_code = generate_referral_code()
    
    # Ensure unique referral code
    while await db.mlm_users.find_one({"referral_code": referral_code}):
        referral_code = generate_referral_code()
    
    user = MLMUser(
        mobile_number=user_data.mobile_number,
        full_name=user_data.full_name,
        upi_address=user_data.upi_address,
        referral_code=referral_code,
        referred_by=user_data.referred_by_code
    )
    
    user_dict = prepare_for_mongo(user.dict())
    user_dict["password"] = hashed_password
    
    await db.mlm_users.insert_one(user_dict)
    
    # Update referrer's direct referrals if exists
    if referrer:
        await db.mlm_users.update_one(
            {"id": referrer["id"]},
            {
                "$push": {"direct_referrals": user.id},
                "$inc": {"total_referrals": 1}
            }
        )
        await update_referral_eligibility(referrer["id"])
    
    return {
        "message": "Registration successful",
        "user_id": user.id,
        "referral_code": referral_code,
        "mobile_number": user.mobile_number
    }

@api_router.post("/auth/login")
async def login(user_login: MLMLogin):
    user = await db.mlm_users.find_one({"mobile_number": user_login.mobile_number})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid mobile number or password")
    
    access_token = create_access_token({"user_id": user["id"], "role": user["role"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": MLMUser(**parse_from_mongo(user)).dict()
    }

@api_router.post("/admin/mark-registration-paid/{user_id}")
async def mark_registration_paid(user_id: str, current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can mark registration as paid")
    
    settings = await get_mlm_settings()
    
    # Update user registration status
    result = await db.mlm_users.update_one(
        {"id": user_id},
        {"$set": {"registration_fee_paid": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Record transaction
    transaction = Transaction(
        user_id=user_id,
        type="registration_fee",
        amount=settings.registration_fee,
        description="Registration fee payment"
    )
    await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
    
    return {"message": "Registration fee marked as paid"}

@api_router.get("/assignments")
async def get_assignments(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role == "admin":
        # Admin sees all assignments with member details
        assignments = await db.mlm_assignments.find({"is_active": True}).to_list(None)
        
        result = []
        for assignment in assignments:
            parsed = parse_from_mongo(assignment)
            
            # Get assigned member details (only if assigned_to exists)
            if "assigned_to" in parsed:
                member = await db.mlm_users.find_one({"id": parsed["assigned_to"]})
                if member:
                    parsed["member_name"] = member["full_name"]
                    parsed["member_mobile"] = member["mobile_number"]
            else:
                # Old assignment without assigned_to field
                parsed["member_name"] = "Unassigned"
                parsed["member_mobile"] = "N/A"
            
            # Check for submission
            submission = await db.mlm_submissions.find_one({
                "assignment_id": parsed["id"]
            })
            parsed["has_submission"] = submission is not None
            if submission:
                parsed["submission"] = parse_from_mongo(submission)
            
            result.append(parsed)
        
        return result
    else:
        # Member sees only their assignments
        assignments = await db.mlm_assignments.find({
            "assigned_to": current_user.id,
            "is_active": True
        }).to_list(None)
        
        result = []
        for assignment in assignments:
            parsed = parse_from_mongo(assignment)
            
            # Check if user has submitted this assignment
            submission = await db.mlm_submissions.find_one({
                "assignment_id": parsed["id"],
                "user_id": current_user.id
            })
            
            parsed["user_submission"] = parse_from_mongo(submission) if submission else None
            parsed["has_submitted"] = submission is not None
            
            result.append(parsed)
        
        return result

@api_router.post("/assignments")
async def create_assignment(
    title: str = Form(...),
    description: str = Form(...),
    amount: float = Form(...),
    deadline: str = Form(...),
    assigned_to: str = Form(...),  # "all_members" or specific user_id
    file: Optional[UploadFile] = File(None),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create assignments")
    
    assignment_data = {
        "title": title,
        "description": description,
        "amount": amount,
        "created_by": current_user.id,
        "deadline": datetime.fromisoformat(deadline.replace('Z', '+00:00'))
    }
    
    if file:
        # Validate file type for assignments
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', 
                            '.ppt', '.pptx', '.xls', '.xlsx', '.mp4', '.avi', '.mov', '.wmv'}
        
        file_ext = Path(file.filename).suffix.lower() if file.filename else ''
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"File type {file_ext} not supported. Allowed types: images, PDF, Office files, videos")
        
        file_content = await file.read()
        assignment_data["attachment_name"] = file.filename
        assignment_data["attachment_data"] = base64.b64encode(file_content).decode('utf-8')
    
    # Handle assignment to all members vs specific member
    if assigned_to == "all_members":
        # Get all active members with paid registration
        members = await db.mlm_users.find({
            "role": "member", 
            "is_active": True, 
            "registration_fee_paid": True
        }).to_list(None)
        
        assignment_ids = []
        for member in members:
            # Create individual assignment for each member
            member_assignment_data = assignment_data.copy()
            member_assignment_data["assigned_to"] = member["id"]
            
            assignment = MLMWorkAssignment(**member_assignment_data)
            await db.mlm_assignments.insert_one(prepare_for_mongo(assignment.dict()))
            assignment_ids.append(assignment.id)
        
        return {
            "message": f"Assignment created for {len(members)} members",
            "assignment_ids": assignment_ids,
            "members_count": len(members)
        }
    else:
        # Single member assignment
        assignment_data["assigned_to"] = assigned_to
        assignment = MLMWorkAssignment(**assignment_data)
        await db.mlm_assignments.insert_one(prepare_for_mongo(assignment.dict()))
        
        return {"message": "Assignment created successfully", "id": assignment.id}

@api_router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: MLMUser = Depends(get_current_user)
):
    # Check if assignment exists
    assignment = await db.mlm_assignments.find_one({"id": assignment_id, "is_active": True})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check if user already submitted
    existing_submission = await db.mlm_submissions.find_one({
        "assignment_id": assignment_id,
        "user_id": current_user.id
    })
    if existing_submission:
        raise HTTPException(status_code=400, detail="Assignment already submitted")
    
    # Check if user can work (paid at least one installment)
    if not current_user.can_work:
        raise HTTPException(status_code=400, detail="Please pay at least one registration installment to submit work")
    
    submission_data = {
        "assignment_id": assignment_id,
        "user_id": current_user.id,
        "notes": notes
    }
    
    if file:
        # Validate file type
        allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', 
                            '.ppt', '.pptx', '.xls', '.xlsx', '.mp4', '.avi', '.mov', '.wmv'}
        
        file_ext = Path(file.filename).suffix.lower() if file.filename else ''
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail=f"File type {file_ext} not supported. Allowed types: images, PDF, Office files, videos")
        
        file_content = await file.read()
        submission_data["submission_file_name"] = file.filename
        submission_data["submission_file_data"] = base64.b64encode(file_content).decode('utf-8')
    
    submission = MLMWorkSubmission(**submission_data)
    await db.mlm_submissions.insert_one(prepare_for_mongo(submission.dict()))
    
    return {"message": "Work submitted successfully. It will be reviewed by admin."}

@api_router.post("/submissions/{submission_id}/review")
async def review_submission(
    submission_id: str,
    action: str = Form(...),  # "approve" or "reject"
    comments: Optional[str] = Form(None),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can review submissions")
    
    submission = await db.mlm_submissions.find_one({"id": submission_id})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    
    assignment = await db.mlm_assignments.find_one({"id": submission["assignment_id"]})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Update submission
    await db.mlm_submissions.update_one(
        {"id": submission_id},
        {"$set": {
            "status": "approved" if action == "approve" else "rejected",
            "admin_comments": comments,
            "reviewed_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if action == "approve":
        # Add earnings to user
        earning_amount = assignment["amount"]
        
        await db.mlm_users.update_one(
            {"id": submission["user_id"]},
            {"$inc": {
                "current_balance": earning_amount,
                "total_earnings": earning_amount
            }}
        )
        
        # Record transaction
        transaction = Transaction(
            user_id=submission["user_id"],
            type="earning",
            amount=earning_amount,
            description=f"Work approved: {assignment['title']}",
            reference_id=assignment["id"]
        )
        await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
        
        # Distribute commissions
        await calculate_and_distribute_commissions(submission["user_id"], earning_amount)
    
    return {
        "message": f"Submission {action}d successfully",
        "amount_credited": assignment["amount"] if action == "approve" else 0
    }

@api_router.post("/withdrawal/request")
async def request_withdrawal(
    amount: float = Form(...),
    current_user: MLMUser = Depends(get_current_user)
):
    settings = await get_mlm_settings()
    
    # Check direct referrals count
    direct_referrals_count = len(current_user.direct_referrals)
    needed_referrals = 5 - direct_referrals_count
    
    if not current_user.can_withdraw:
        if direct_referrals_count == 0:
            raise HTTPException(status_code=400, detail="You need 5 joiners to request withdrawal")
        else:
            raise HTTPException(status_code=400, detail=f"You need {needed_referrals} more joiner{'s' if needed_referrals > 1 else ''} to request withdrawal")
    
    if amount < settings.minimum_withdrawal:
        raise HTTPException(status_code=400, detail=f"Minimum withdrawal amount is ₹{settings.minimum_withdrawal}")
    
    if amount > current_user.current_balance:
        raise HTTPException(status_code=400, detail="Insufficient balance")
    
    # Create withdrawal request
    withdrawal = WithdrawalRequest(
        user_id=current_user.id,
        amount=amount,
        upi_address=current_user.upi_address
    )
    
    await db.withdrawal_requests.insert_one(prepare_for_mongo(withdrawal.dict()))
    
    # Deduct from balance temporarily
    await db.mlm_users.update_one(
        {"id": current_user.id},
        {"$inc": {"current_balance": -amount}}
    )
    
    return {"message": "Withdrawal request submitted successfully"}

@api_router.get("/withdrawal/requests")
async def get_withdrawal_requests(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view withdrawal requests")
    
    requests = await db.withdrawal_requests.find({}).to_list(None)
    
    result = []
    for req in requests:
        parsed = parse_from_mongo(req)
        user = await db.mlm_users.find_one({"id": parsed["user_id"]})
        if user:
            parsed["user_name"] = user["full_name"]
            parsed["user_mobile"] = user["mobile_number"]
        result.append(parsed)
    
    return result

@api_router.post("/withdrawal/{withdrawal_id}/process")
async def process_withdrawal(
    withdrawal_id: str,
    action: str = Form(...),  # "approve", "reject", "mark_paid"
    comments: Optional[str] = Form(None),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can process withdrawals")
    
    withdrawal = await db.withdrawal_requests.find_one({"id": withdrawal_id})
    if not withdrawal:
        raise HTTPException(status_code=404, detail="Withdrawal request not found")
    
    if action == "approve":
        await db.withdrawal_requests.update_one(
            {"id": withdrawal_id},
            {"$set": {
                "status": "approved",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "processed_by": current_user.id,
                "admin_comments": comments
            }}
        )
    
    elif action == "reject":
        # Return money to user balance
        await db.mlm_users.update_one(
            {"id": withdrawal["user_id"]},
            {"$inc": {"current_balance": withdrawal["amount"]}}
        )
        
        await db.withdrawal_requests.update_one(
            {"id": withdrawal_id},
            {"$set": {
                "status": "rejected",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "processed_by": current_user.id,
                "admin_comments": comments
            }}
        )
    
    elif action == "mark_paid":
        await db.withdrawal_requests.update_one(
            {"id": withdrawal_id},
            {"$set": {
                "status": "paid",
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "processed_by": current_user.id
            }}
        )
        
        # Record transaction
        transaction = Transaction(
            user_id=withdrawal["user_id"],
            type="withdrawal",
            amount=-withdrawal["amount"],
            description=f"Withdrawal to UPI: {withdrawal['upi_address']}",
            reference_id=withdrawal_id
        )
        await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
        
        # Update user's total withdrawn
        await db.mlm_users.update_one(
            {"id": withdrawal["user_id"]},
            {"$inc": {"total_withdrawn": withdrawal["amount"]}}
        )
    
    return {"message": f"Withdrawal {action}d successfully"}

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role == "admin":
        total_users = await db.mlm_users.count_documents({"role": "member"})
        active_assignments = await db.mlm_assignments.count_documents({"is_active": True})
        pending_submissions = await db.mlm_submissions.count_documents({"status": "pending"})
        pending_withdrawals = await db.withdrawal_requests.count_documents({"status": "pending"})
        
        # Calculate total earnings in system
        pipeline = [
            {"$match": {"role": "member"}},
            {"$group": {
                "_id": None,
                "total_earnings": {"$sum": "$total_earnings"},
                "total_balance": {"$sum": "$current_balance"},
                "total_withdrawn": {"$sum": "$total_withdrawn"}
            }}
        ]
        
        result = await db.mlm_users.aggregate(pipeline).to_list(1)
        earnings = result[0] if result else {"total_earnings": 0, "total_balance": 0, "total_withdrawn": 0}
        
        return {
            "total_users": total_users,
            "active_assignments": active_assignments,
            "pending_submissions": pending_submissions,
            "pending_withdrawals": pending_withdrawals,
            "total_system_earnings": earnings["total_earnings"],
            "total_system_balance": earnings["total_balance"],
            "total_system_withdrawn": earnings["total_withdrawn"]
        }
    else:
        # Get user's transactions
        transactions = await db.transactions.find({"user_id": current_user.id}).to_list(None)
        daily_earnings = {}
        
        for txn in transactions:
            if txn["type"] in ["earning", "commission"]:
                date_str = txn["date"][:10] if isinstance(txn["date"], str) else txn["date"].strftime("%Y-%m-%d")
                daily_earnings[date_str] = daily_earnings.get(date_str, 0) + txn["amount"]
        
        # Get pending submissions
        pending_count = await db.mlm_submissions.count_documents({
            "user_id": current_user.id,
            "status": "pending"
        })
        
        # Get admin UPI for payment info
        settings = await db.mlm_settings.find_one({})
        admin_upi = settings.get("admin_upi", "admin@upi") if settings else "admin@upi"
        
        # Get upline (referrer) information
        upline_info = None
        if current_user.referred_by:
            upline = await db.mlm_users.find_one({"referral_code": current_user.referred_by})
            if upline:
                upline_info = {
                    "name": upline.get("full_name"),
                    "mobile": upline.get("mobile_number")
                }
        
        return {
            "current_balance": current_user.current_balance,
            "total_earnings": current_user.total_earnings,
            "total_withdrawn": current_user.total_withdrawn,
            "total_installments_paid": current_user.total_installments_paid,
            "direct_referrals": len(current_user.direct_referrals),
            "can_withdraw": current_user.can_withdraw,
            "registration_fee_paid": current_user.registration_fee_paid,
            "pending_submissions": pending_count,
            "daily_earnings": daily_earnings,
            "referral_code": current_user.referral_code,
            "admin_upi": admin_upi,
            "upline": upline_info
        }

@api_router.get("/transactions")
async def get_transactions(current_user: MLMUser = Depends(get_current_user)):
    transactions = await db.transactions.find({"user_id": current_user.id}).sort("date", -1).to_list(None)
    return [parse_from_mongo(txn) for txn in transactions]

@api_router.get("/referral/tree")
async def get_referral_tree(
    current_user: MLMUser = Depends(get_current_user),
    user_id: str = None
):
    """Get referral network tree data"""
    
    async def build_tree_node(user_data, level=1, max_level=5):
        node = {
            "id": user_data["id"],
            "name": user_data["full_name"],
            "mobile": user_data["mobile_number"],
            "earnings": user_data.get("total_earnings", 0),
            "level": level,
            "children": []
        }
        
        if level < max_level:
            # Get direct referrals by referral code
            referrals = await db.mlm_users.find({
                "referred_by": user_data["referral_code"]
            }).to_list(None)
            
            for referral in referrals:
                child_node = await build_tree_node(referral, level + 1, max_level)
                node["children"].append(child_node)
        
        return node
    
    # If user_id provided (admin viewing specific user's tree)
    if user_id and current_user.role == "admin":
        user_data = await db.mlm_users.find_one({"id": user_id})
        if user_data:
            tree = await build_tree_node(user_data)
            return [tree]
        return []
    
    # Admin viewing all root-level trees
    if current_user.role == "admin":
        # Get all users who have no referrer (empty string or None)
        root_users = await db.mlm_users.find({
            "$or": [
                {"referred_by": {"$exists": False}},
                {"referred_by": None},
                {"referred_by": ""}
            ]
        }).to_list(None)
        trees = []
        for root_user in root_users:
            if root_user.get("role") != "admin":  # Skip admin from tree
                tree = await build_tree_node(root_user)
                trees.append(tree)
        return trees
    else:
        # Member sees their downline tree (children are level 1)
        user_data = await db.mlm_users.find_one({"id": current_user.id})
        
        # Get direct referrals only (these are Level 1 for the member)
        direct_referrals = await db.mlm_users.find({
            "referred_by": user_data["referral_code"]
        }).to_list(None)
        
        trees = []
        for referral in direct_referrals:
            tree = await build_tree_node(referral, level=1, max_level=5)
            trees.append(tree)
        
        return trees

@api_router.get("/admin/users")
async def get_all_users(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view all users")
    
    users = await db.mlm_users.find({"role": "member"}).to_list(None)
    
    result = []
    for user in users:
        parsed = parse_from_mongo(user)
        
        # Get downline members (joiners)
        downline = await db.mlm_users.find({
            "referred_by": user["referral_code"]
        }).to_list(None)
        
        parsed["downline_members"] = [
            {
                "id": member["id"],
                "full_name": member["full_name"],
                "mobile_number": member["mobile_number"],
                "registration_fee_paid": member.get("registration_fee_paid", False),
                "total_earnings": member.get("total_earnings", 0)
            } for member in downline
        ]
        parsed["downline_count"] = len(downline)
        
        result.append(parsed)
    
    return result

@api_router.get("/admin/member/{member_id}/network")
async def get_member_network(member_id: str, current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view member networks")
    
    # Get the member
    member = await db.mlm_users.find_one({"id": member_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Get all downline members up to 5 levels
    async def get_network_recursive(referral_code, level=1, max_level=5):
        if level > max_level:
            return []
        
        direct_members = await db.mlm_users.find({
            "referred_by": referral_code
        }).to_list(None)
        
        network = []
        for direct_member in direct_members:
            member_data = {
                "id": direct_member["id"],
                "full_name": direct_member["full_name"],
                "mobile_number": direct_member["mobile_number"],
                "referral_code": direct_member["referral_code"],
                "registration_fee_paid": direct_member.get("registration_fee_paid", False),
                "total_earnings": direct_member.get("total_earnings", 0),
                "level": level,
                "downline": await get_network_recursive(direct_member["referral_code"], level + 1, max_level)
            }
            network.append(member_data)
        
        return network
    
    network = await get_network_recursive(member["referral_code"])
    
    return {
        "member": {
            "id": member["id"],
            "full_name": member["full_name"],
            "mobile_number": member["mobile_number"],
            "referral_code": member["referral_code"]
        },
        "network": network,
        "total_network_size": await count_network_size(member["referral_code"])
    }

async def count_network_size(referral_code, level=1, max_level=5):
    if level > max_level:
        return 0
    
    direct_count = await db.mlm_users.count_documents({"referred_by": referral_code})
    
    # Get all direct members and count their networks recursively
    direct_members = await db.mlm_users.find({"referred_by": referral_code}).to_list(None)
    
    total = direct_count
    for member in direct_members:
        total += await count_network_size(member["referral_code"], level + 1, max_level)
    
    return total

@api_router.get("/admin/submissions")
async def get_all_submissions(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view all submissions")
    
    submissions = await db.mlm_submissions.find({}).to_list(None)
    
    result = []
    for submission in submissions:
        parsed = parse_from_mongo(submission)
        
        # Get user and assignment details
        user = await db.mlm_users.find_one({"id": parsed["user_id"]})
        assignment = await db.mlm_assignments.find_one({"id": parsed["assignment_id"]})
        
        if user and assignment:
            parsed["user_name"] = user["full_name"]
            parsed["user_mobile"] = user["mobile_number"]
            parsed["assignment_title"] = assignment["title"]
            parsed["assignment_amount"] = assignment["amount"]
        
        result.append(parsed)
    
    return result

@api_router.get("/assignments/{assignment_id}/download")
async def download_submission(
    assignment_id: str,
    user_id: Optional[str] = None,
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can download submissions")
    
    # Find submission
    query = {"assignment_id": assignment_id}
    if user_id:
        query["user_id"] = user_id
    
    submission = await db.mlm_submissions.find_one(query)
    if not submission or not submission.get("submission_file_data"):
        raise HTTPException(status_code=404, detail="No submission file found")
    
    try:
        file_data = base64.b64decode(submission["submission_file_data"])
        filename = submission.get("submission_file_name", "submission_file")
        
        return Response(
            content=file_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error processing file download")

@api_router.get("/assignments/{assignment_id}/attachment")
async def download_assignment_attachment(
    assignment_id: str,
    current_user: MLMUser = Depends(get_current_user)
):
    assignment = await db.mlm_assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    if not assignment.get("attachment_data"):
        raise HTTPException(status_code=404, detail="No attachment found")
    
    try:
        file_data = base64.b64decode(assignment["attachment_data"])
        filename = assignment.get("attachment_name", "assignment_file")
        
        return Response(
            content=file_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error processing file download")

@api_router.post("/admin/settings")
async def update_settings(
    registration_fee: Optional[float] = Form(None),
    minimum_withdrawal: Optional[float] = Form(None),
    admin_upi: Optional[str] = Form(None),
    commission_l1: Optional[float] = Form(None),
    commission_l2: Optional[float] = Form(None),
    commission_l3: Optional[float] = Form(None),
    commission_l4: Optional[float] = Form(None),
    commission_l5: Optional[float] = Form(None),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update settings")
    
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": current_user.id}
    
    if registration_fee is not None:
        update_data["registration_fee"] = registration_fee
    if minimum_withdrawal is not None:
        update_data["minimum_withdrawal"] = minimum_withdrawal
    if admin_upi is not None:
        update_data["admin_upi"] = admin_upi
    if commission_l1 is not None:
        update_data["commission_l1"] = commission_l1
    if commission_l2 is not None:
        update_data["commission_l2"] = commission_l2
    if commission_l3 is not None:
        update_data["commission_l3"] = commission_l3
    if commission_l4 is not None:
        update_data["commission_l4"] = commission_l4
    if commission_l5 is not None:
        update_data["commission_l5"] = commission_l5
    
    await db.mlm_settings.update_one({}, {"$set": update_data}, upsert=True)
    
    return {"message": "Settings updated successfully"}

@api_router.get("/admin/settings")
async def get_settings(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view settings")
    
    settings = await get_mlm_settings()
    return settings.dict()

@api_router.get("/referral/validate/{referral_code}")
async def validate_referral_code(referral_code: str):
    """Validate referral code and return referrer info"""
    referrer = await db.mlm_users.find_one({"referral_code": referral_code})
    if not referrer:
        raise HTTPException(status_code=404, detail="Invalid referral code")
    
    return {
        "valid": True,
        "referrer_name": referrer["full_name"],
        "referrer_mobile": referrer["mobile_number"],
        "referral_code": referral_code
    }

@api_router.post("/admin/change-password")
async def admin_change_password(
    new_password: str = Form(...),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can change password")
    
    hashed_password = get_password_hash(new_password)
    
    await db.mlm_users.update_one(
        {"id": current_user.id},
        {"$set": {"password": hashed_password}}
    )
    
    return {"message": "Password changed successfully"}

@api_router.post("/admin/installment-payment/{user_id}")
async def record_installment_payment(
    user_id: str,
    installment_data: InstallmentPayment,
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can record installment payments")
    
    # Get user
    user = await db.mlm_users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings = await get_mlm_settings()
    
    # Add to installments
    installments = user.get("registration_installments", [])
    installments.append(installment_data.amount)
    
    total_paid = sum(installments)
    can_work = len(installments) >= 1  # Can work after first installment
    registration_complete = total_paid >= settings.registration_fee
    
    # Update user
    update_data = {
        "registration_installments": installments,
        "total_installments_paid": total_paid,
        "can_work": can_work,
        "registration_fee_paid": registration_complete
    }
    
    await db.mlm_users.update_one(
        {"id": user_id},
        {"$set": update_data}
    )
    
    # Record transaction
    transaction = Transaction(
        user_id=user_id,
        type="registration_fee",
        amount=installment_data.amount,
        description=f"Registration fee installment {installment_data.installment_number}/10"
    )
    await db.transactions.insert_one(prepare_for_mongo(transaction.dict()))
    
    return {
        "message": f"Installment {installment_data.installment_number} recorded successfully",
        "total_paid": total_paid,
        "remaining": settings.registration_fee - total_paid,
        "can_work": can_work,
        "registration_complete": registration_complete
    }

@api_router.post("/daily-work-report")
async def submit_daily_work_report(
    date: str = Form(...),
    class_name: str = Form(...),
    subject: str = Form(...),
    details: str = Form(...),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "member":
        raise HTTPException(status_code=403, detail="Only members can submit daily work reports")
    
    # Check if user can work (paid at least one installment)
    if not current_user.can_work:
        raise HTTPException(status_code=400, detail="Please pay at least one registration installment to submit work")
    
    # Check if report already exists for this date
    existing = await db.daily_work_reports.find_one({
        "user_id": current_user.id,
        "date": date
    })
    
    if existing:
        # Update existing report
        await db.daily_work_reports.update_one(
            {"user_id": current_user.id, "date": date},
            {"$set": {
                "class_name": class_name,
                "subject": subject,
                "details": details,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Daily work report updated successfully"}
    else:
        # Create new report
        report = DailyWorkReport(
            user_id=current_user.id,
            date=date,
            class_name=class_name,
            subject=subject,
            details=details
        )
        
        await db.daily_work_reports.insert_one(prepare_for_mongo(report.dict()))
        return {"message": "Daily work report submitted successfully"}

@api_router.post("/daily-work-report-paragraph")
async def submit_daily_work_report_paragraph(
    date: str = Form(...),
    name: str = Form(...),
    update: str = Form(...),
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "member":
        raise HTTPException(status_code=403, detail="Only members can submit daily work reports")
    
    # Check if user can work (paid at least one installment)
    if not current_user.can_work:
        raise HTTPException(status_code=400, detail="Please pay at least one registration installment to submit work")
    
    # Store in same collection with format indicator
    report = DailyWorkReport(
        user_id=current_user.id,
        date=date,
        class_name=name,  # Repurpose class_name for name
        subject="Paragraph Format",  # Indicator
        details=update
    )
    
    # Check if report already exists for this date
    existing = await db.daily_work_reports.find_one({
        "user_id": current_user.id,
        "date": date,
        "subject": "Paragraph Format"
    })
    
    if existing:
        # Update existing report
        await db.daily_work_reports.update_one(
            {"user_id": current_user.id, "date": date, "subject": "Paragraph Format"},
            {"$set": {
                "class_name": name,
                "details": update,
                "submitted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {"message": "Daily work report updated successfully"}
    else:
        await db.daily_work_reports.insert_one(prepare_for_mongo(report.dict()))
        return {"message": "Daily work report submitted successfully"}

@api_router.get("/daily-work-reports")
async def get_daily_work_reports(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role == "admin":
        # Admin sees all reports
        reports = await db.daily_work_reports.find({}).sort("date", -1).to_list(None)
        
        result = []
        for report in reports:
            parsed = parse_from_mongo(report)
            
            # Get user info
            user = await db.mlm_users.find_one({"id": parsed["user_id"]})
            if user:
                parsed["user_name"] = user["full_name"]
                parsed["user_mobile"] = user["mobile_number"]
            
            result.append(parsed)
        
        return result
    else:
        # Member sees only their reports
        reports = await db.daily_work_reports.find({
            "user_id": current_user.id
        }).sort("date", -1).to_list(None)
        
        return [parse_from_mongo(report) for report in reports]

@api_router.get("/admin/daily-work-reports/export")
async def export_daily_work_reports(current_user: MLMUser = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can export reports")
    
    try:
        import pandas as pd
        from io import BytesIO
        
        # Get all reports
        reports = await db.daily_work_reports.find({}).sort("date", -1).to_list(None)
        
        export_data = []
        for report in reports:
            parsed = parse_from_mongo(report)
            
            # Get user info
            user = await db.mlm_users.find_one({"id": parsed["user_id"]})
            
            export_data.append({
                "Date": parsed["date"],
                "Employee Name": user["full_name"] if user else "Unknown",
                "Mobile Number": user["mobile_number"] if user else "Unknown",
                "Class": parsed["class_name"],
                "Subject": parsed["subject"],
                "Work Details": parsed["details"],
                "Submitted At": parsed["submitted_at"].strftime("%Y-%m-%d %H:%M:%S") if isinstance(parsed["submitted_at"], datetime) else parsed["submitted_at"]
            })
        
        # Create Excel file
        df = pd.DataFrame(export_data)
        
        # Create BytesIO buffer
        buffer = BytesIO()
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Daily Work Reports', index=False)
        
        buffer.seek(0)
        
        return Response(
            content=buffer.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=daily_work_reports.xlsx"}
        )
        
    except ImportError:
        raise HTTPException(status_code=500, detail="Excel export feature not available")

# Remove member endpoint
@api_router.delete("/admin/remove-member/{user_id}")
async def remove_member(
    user_id: str,
    current_user: MLMUser = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can remove members")
    
    # Find the member to remove
    member = await db.mlm_users.find_one({"id": user_id})
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    if member["role"] == "admin":
        raise HTTPException(status_code=403, detail="Cannot remove admin user")
    
    # Get member's referrer to update their downline count
    if member.get("referred_by"):
        referrer = await db.mlm_users.find_one({"id": member["referred_by"]})
        if referrer:
            # Remove this member from referrer's direct_referrals list
            updated_referrals = [ref for ref in referrer.get("direct_referrals", []) if ref != user_id]
            await db.mlm_users.update_one(
                {"id": member["referred_by"]},
                {"$set": {"direct_referrals": updated_referrals}}
            )
    
    # Delete member's assignments
    await db.mlm_assignments.delete_many({"assigned_to": user_id})
    
    # Delete member's submissions
    await db.mlm_submissions.delete_many({"user_id": user_id})
    
    # Delete member's transactions
    await db.transactions.delete_many({"user_id": user_id})
    
    # Delete member's daily work reports
    await db.daily_work_reports.delete_many({"user_id": user_id})
    
    # Delete member's withdrawal requests
    await db.withdrawal_requests.delete_many({"user_id": user_id})
    
    # Finally, delete the member
    await db.mlm_users.delete_one({"id": user_id})
    
    return {"message": "Member removed successfully", "removed_user_id": user_id}

# Initialize admin user and settings
@api_router.post("/init")
async def initialize_system():
    # Check if admin exists
    admin = await db.mlm_users.find_one({"role": "admin"})
    if admin:
        return {"message": "System already initialized"}
    
    # Create admin user
    admin_user = MLMUser(
        mobile_number="9999999999",
        full_name="System Administrator",
        upi_address="admin@upi",
        referral_code="ADMIN001",
        role="admin"
    )
    
    admin_data = prepare_for_mongo(admin_user.dict())
    admin_data["password"] = get_password_hash("admin123")
    
    await db.mlm_users.insert_one(admin_data)
    
    # Initialize settings
    settings = MLMSettings(updated_by=admin_user.id)
    await db.mlm_settings.insert_one(prepare_for_mongo(settings.dict()))
    
    return {
        "message": "Life Line's MLM System initialized",
        "admin_mobile": "9999999999",
        "admin_password": "admin123"
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()