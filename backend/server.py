from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import base64
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Life Line's Work Portal")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Models
class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    email: str
    role: str  # "admin" or "employee"
    full_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    total_earnings: float = 0.0
    pending_earnings: float = 0.0
    credited_earnings: float = 0.0

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    full_name: str
    role: str = "employee"

class UserLogin(BaseModel):
    username: str
    password: str

class WorkAssignment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str
    assigned_to: str  # employee user id
    assigned_by: str  # admin user id
    deadline: datetime
    resubmission_deadline: Optional[datetime] = None
    amount: float = 0.0
    attachment_name: Optional[str] = None
    attachment_data: Optional[str] = None  # base64 encoded file
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"  # "pending", "submitted", "accepted", "rejected", "resubmitted"
    review_comments: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_deadline_hours: int = 24

class WorkAssignmentCreate(BaseModel):
    title: str
    description: str
    assigned_to: str
    deadline: str  # ISO format string
    amount: float
    review_deadline_hours: int = 24

class WorkSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    submitted_by: str
    submission_file_name: Optional[str] = None
    submission_file_data: Optional[str] = None  # base64 encoded
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_resubmission: bool = False

class ReviewSubmission(BaseModel):
    action: str  # "accept" or "reject"
    comments: Optional[str] = None
    resubmission_hours: Optional[int] = 48

class PaymentAction(BaseModel):
    action: str  # "mark_paid" or "mark_unpaid"

class TimeTrackingSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())

class SystemSettings(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    portal_enabled: bool = True
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_by: str

# Helper functions
def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Convert ISO strings back to datetime objects and remove MongoDB ObjectId"""
    if isinstance(item, dict):
        # Remove MongoDB's _id field to avoid ObjectId serialization issues
        if '_id' in item:
            del item['_id']
            
        for key, value in item.items():
            if isinstance(value, str) and (key.endswith('_at') or key.endswith('_time')):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
            elif key == 'deadline' and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
            elif key == 'resubmission_deadline' and isinstance(value, str):
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

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user = await db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        return User(**parse_from_mongo(user))
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def check_portal_status():
    """Check if portal is enabled for employee access"""
    settings = await db.system_settings.find_one({})
    if not settings:
        # Create default settings
        default_settings = SystemSettings(updated_by="system")
        await db.system_settings.insert_one(prepare_for_mongo(default_settings.dict()))
        return True
    return settings.get("portal_enabled", True)

# Routes
@api_router.get("/")
async def root():
    return {"message": "Life Line's Work Portal API"}

@api_router.get("/portal-status")
async def get_portal_status():
    enabled = await check_portal_status()
    return {"enabled": enabled}

@api_router.post("/auth/login")
async def login(user_login: UserLogin):
    # Check portal status for employees
    if user_login.username != "admin":
        portal_enabled = await check_portal_status()
        if not portal_enabled:
            raise HTTPException(status_code=403, detail="Portal is currently disabled. Please contact administrator.")
    
    user = await db.users.find_one({"username": user_login.username})
    if not user or not verify_password(user_login.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    
    # Create time tracking session for employee
    if user["role"] == "employee":
        session = TimeTrackingSession(user_id=user["id"])
        await db.time_sessions.insert_one(prepare_for_mongo(session.dict()))
    
    access_token = create_access_token({"user_id": user["id"], "role": user["role"]})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": User(**parse_from_mongo(user)).dict()
    }

@api_router.post("/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    if current_user.role == "employee":
        # End the current session
        session = await db.time_sessions.find_one({
            "user_id": current_user.id,
            "end_time": None
        })
        
        if session:
            end_time = datetime.now(timezone.utc)
            start_time = datetime.fromisoformat(session["start_time"]) if isinstance(session["start_time"], str) else session["start_time"]
            duration = int((end_time - start_time).total_seconds() / 60)
            
            await db.time_sessions.update_one(
                {"id": session["id"]},
                {"$set": {
                    "end_time": end_time.isoformat(),
                    "duration_minutes": duration
                }}
            )
    
    return {"message": "Logged out successfully"}

@api_router.post("/users", response_model=User)
async def create_user(user_create: UserCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create users")
    
    # Check if username exists
    existing = await db.users.find_one({"username": user_create.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Create user
    hashed_password = get_password_hash(user_create.password)
    user_dict = user_create.dict()
    user_dict["password"] = hashed_password
    
    user = User(**{k: v for k, v in user_dict.items() if k != "password"})
    user_data = prepare_for_mongo(user.dict())
    user_data["password"] = hashed_password
    
    await db.users.insert_one(user_data)
    return user

@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view users")
    
    users = await db.users.find({"role": "employee"}).to_list(None)
    return [User(**parse_from_mongo(user)) for user in users]

@api_router.post("/assignments")
async def create_assignment(
    title: str = Form(...),
    description: str = Form(...),
    assigned_to: str = Form(...),
    deadline: str = Form(...),
    amount: float = Form(...),
    review_deadline_hours: int = Form(24),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create assignments")
    
    assignment_data = {
        "title": title,
        "description": description,
        "assigned_to": assigned_to,
        "assigned_by": current_user.id,
        "deadline": datetime.fromisoformat(deadline.replace('Z', '+00:00')),
        "amount": amount,
        "review_deadline_hours": review_deadline_hours
    }
    
    if file:
        file_content = await file.read()
        assignment_data["attachment_name"] = file.filename
        assignment_data["attachment_data"] = base64.b64encode(file_content).decode('utf-8')
    
    assignment = WorkAssignment(**assignment_data)
    await db.assignments.insert_one(prepare_for_mongo(assignment.dict()))
    return {"message": "Assignment created successfully", "id": assignment.id}

@api_router.get("/assignments")
async def get_assignments(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        assignments = await db.assignments.find().to_list(None)
    else:
        assignments = await db.assignments.find({"assigned_to": current_user.id}).to_list(None)
    
    result = []
    for assignment in assignments:
        parsed = parse_from_mongo(assignment)
        # Get employee info for admin view
        if current_user.role == "admin" and "assigned_to" in parsed:
            employee = await db.users.find_one({"id": parsed["assigned_to"]})
            if employee:
                parsed["employee_name"] = employee["full_name"]
        
        # Check for submission
        submission = await db.submissions.find_one({"assignment_id": parsed["id"]})
        parsed["has_submission"] = submission is not None
        if submission:
            parsed["submission"] = parse_from_mongo(submission)
        
        # Calculate review deadline
        if parsed["status"] == "submitted" and "submitted_at" in (parsed.get("submission") or {}):
            submitted_time = parsed["submission"]["submitted_at"]
            if isinstance(submitted_time, str):
                submitted_time = datetime.fromisoformat(submitted_time)
            review_deadline = submitted_time + timedelta(hours=parsed.get("review_deadline_hours", 24))
            parsed["review_deadline"] = review_deadline.isoformat()
        
        result.append(parsed)
    
    return result

@api_router.post("/assignments/{assignment_id}/submit")
async def submit_assignment(
    assignment_id: str,
    notes: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "employee":
        raise HTTPException(status_code=403, detail="Only employees can submit assignments")
    
    # Check if assignment exists and belongs to user
    assignment = await db.assignments.find_one({"id": assignment_id, "assigned_to": current_user.id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check if assignment allows submissions (not rejected with passed resubmission deadline)
    if assignment["status"] == "rejected" and assignment.get("resubmission_deadline"):
        resubmission_deadline = datetime.fromisoformat(assignment["resubmission_deadline"])
        if datetime.now(timezone.utc) > resubmission_deadline:
            raise HTTPException(status_code=400, detail="Resubmission deadline has passed")
    
    submission_data = {
        "assignment_id": assignment_id,
        "submitted_by": current_user.id,
        "notes": notes,
        "is_resubmission": assignment["status"] == "rejected"
    }
    
    if file:
        file_content = await file.read()
        submission_data["submission_file_name"] = file.filename
        submission_data["submission_file_data"] = base64.b64encode(file_content).decode('utf-8')
    
    submission = WorkSubmission(**submission_data)
    
    # Remove old submission if exists
    await db.submissions.delete_many({"assignment_id": assignment_id})
    
    # Insert new submission
    await db.submissions.insert_one(prepare_for_mongo(submission.dict()))
    
    # Update assignment status
    new_status = "resubmitted" if submission.is_resubmission else "submitted"
    await db.assignments.update_one(
        {"id": assignment_id},
        {"$set": {
            "status": new_status,
            "resubmission_deadline": None,
            "review_comments": None
        }}
    )
    
    return {"message": "Assignment submitted successfully. It will be reviewed and you will be informed within 24 hours."}

@api_router.post("/assignments/{assignment_id}/review")
async def review_submission(
    assignment_id: str,
    review: ReviewSubmission,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can review submissions")
    
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    submission = await db.submissions.find_one({"assignment_id": assignment_id})
    if not submission:
        raise HTTPException(status_code=404, detail="No submission found for this assignment")
    
    employee = await db.users.find_one({"id": assignment["assigned_to"]})
    
    if review.action == "accept":
        # Update assignment status
        await db.assignments.update_one(
            {"id": assignment_id},
            {"$set": {
                "status": "accepted",
                "review_comments": review.comments,
                "reviewed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update employee earnings
        if employee:
            new_pending = employee.get("pending_earnings", 0) + assignment["amount"]
            new_total = employee.get("total_earnings", 0) + assignment["amount"]
            await db.users.update_one(
                {"id": assignment["assigned_to"]},
                {"$set": {
                    "pending_earnings": new_pending,
                    "total_earnings": new_total
                }}
            )
        
        return {"message": f"Work accepted! Amount ₹{assignment['amount']} has been credited to employee's pending earnings."}
    
    elif review.action == "reject":
        # Set resubmission deadline
        resubmission_deadline = datetime.now(timezone.utc) + timedelta(hours=review.resubmission_hours or 48)
        
        await db.assignments.update_one(
            {"id": assignment_id},
            {"$set": {
                "status": "rejected",
                "review_comments": review.comments,
                "reviewed_at": datetime.now(timezone.utc).isoformat(),
                "resubmission_deadline": resubmission_deadline.isoformat()
            }}
        )
        
        return {"message": f"Work rejected. Employee has {review.resubmission_hours or 48} hours to resubmit with improvements."}

@api_router.post("/assignments/{assignment_id}/payment")
async def manage_payment(
    assignment_id: str,
    payment_action: PaymentAction,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage payments")
    
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment or assignment["status"] != "accepted":
        raise HTTPException(status_code=400, detail="Assignment must be accepted before payment management")
    
    employee = await db.users.find_one({"id": assignment["assigned_to"]})
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    if payment_action.action == "mark_paid":
        # Move from pending to credited
        new_pending = employee.get("pending_earnings", 0) - assignment["amount"]
        new_credited = employee.get("credited_earnings", 0) + assignment["amount"]
        
        await db.users.update_one(
            {"id": assignment["assigned_to"]},
            {"$set": {
                "pending_earnings": max(0, new_pending),
                "credited_earnings": new_credited
            }}
        )
        
        # Mark assignment as paid
        await db.assignments.update_one(
            {"id": assignment_id},
            {"$set": {"payment_status": "paid", "paid_at": datetime.now(timezone.utc).isoformat()}}
        )
        
        return {"message": f"Payment of ₹{assignment['amount']} marked as completed and credited to employee."}
    
    elif payment_action.action == "mark_unpaid":
        # Move from credited back to pending (if needed)
        await db.assignments.update_one(
            {"id": assignment_id},
            {"$unset": {"payment_status": "", "paid_at": ""}}
        )
        
        return {"message": "Payment status reverted to unpaid."}

@api_router.get("/assignments/{assignment_id}/download")
async def download_submission_file(
    assignment_id: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can download submission files")
    
    submission = await db.submissions.find_one({"assignment_id": assignment_id})
    if not submission or not submission.get("submission_file_data"):
        raise HTTPException(status_code=404, detail="No file found for this submission")
    
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
    current_user: User = Depends(get_current_user)
):
    assignment = await db.assignments.find_one({"id": assignment_id})
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    # Check permissions
    if current_user.role != "admin" and assignment["assigned_to"] != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if not assignment.get("attachment_data"):
        raise HTTPException(status_code=404, detail="No attachment found for this assignment")
    
    try:
        file_data = base64.b64decode(assignment["attachment_data"])
        filename = assignment.get("attachment_name", "assignment_attachment")
        
        return Response(
            content=file_data,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error processing file download")

@api_router.get("/time-tracking")
async def get_time_tracking(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view time tracking")
    
    # Get all completed sessions
    sessions = await db.time_sessions.find({"end_time": {"$ne": None}}).to_list(None)
    
    # Group by user and date
    result = {}
    for session in sessions:
        parsed = parse_from_mongo(session)
        user_id = parsed["user_id"]
        date = parsed["date"]
        
        if user_id not in result:
            user = await db.users.find_one({"id": user_id})
            result[user_id] = {
                "user_name": user["full_name"] if user else "Unknown",
                "daily_hours": {}
            }
        
        if date not in result[user_id]["daily_hours"]:
            result[user_id]["daily_hours"][date] = 0
        
        result[user_id]["daily_hours"][date] += parsed.get("duration_minutes", 0)
    
    return result

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    if current_user.role == "admin":
        total_employees = await db.users.count_documents({"role": "employee"})
        total_assignments = await db.assignments.count_documents({})
        pending_assignments = await db.assignments.count_documents({"status": {"$in": ["pending", "submitted", "resubmitted"]}})
        accepted_assignments = await db.assignments.count_documents({"status": "accepted"})
        
        # Calculate total pending and credited earnings
        pipeline = [
            {"$match": {"role": "employee"}},
            {"$group": {
                "_id": None,
                "total_pending": {"$sum": "$pending_earnings"},
                "total_credited": {"$sum": "$credited_earnings"},
                "total_earnings": {"$sum": "$total_earnings"}
            }}
        ]
        
        earnings_result = await db.users.aggregate(pipeline).to_list(1)
        earnings = earnings_result[0] if earnings_result else {"total_pending": 0, "total_credited": 0, "total_earnings": 0}
        
        return {
            "total_employees": total_employees,
            "total_assignments": total_assignments,
            "pending_assignments": pending_assignments,
            "accepted_assignments": accepted_assignments,
            "total_pending_earnings": earnings["total_pending"],
            "total_credited_earnings": earnings["total_credited"],
            "total_earnings": earnings["total_earnings"]
        }
    else:
        my_assignments = await db.assignments.count_documents({"assigned_to": current_user.id})
        pending_assignments = await db.assignments.count_documents({
            "assigned_to": current_user.id,
            "status": {"$in": ["pending", "submitted", "resubmitted"]}
        })
        accepted_assignments = await db.assignments.count_documents({
            "assigned_to": current_user.id,
            "status": "accepted"
        })
        
        # Get user earnings
        user = await db.users.find_one({"id": current_user.id})
        
        return {
            "total_assignments": my_assignments,
            "pending_assignments": pending_assignments,
            "accepted_assignments": accepted_assignments,
            "pending_earnings": user.get("pending_earnings", 0),
            "credited_earnings": user.get("credited_earnings", 0),
            "total_earnings": user.get("total_earnings", 0)
        }

@api_router.post("/system/portal-toggle")
async def toggle_portal_status(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can control portal status")
    
    # Get current settings
    settings = await db.system_settings.find_one({})
    current_status = settings.get("portal_enabled", True) if settings else True
    
    # Toggle status
    new_status = not current_status
    
    if settings:
        await db.system_settings.update_one(
            {"id": settings["id"]},
            {"$set": {
                "portal_enabled": new_status,
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "updated_by": current_user.id
            }}
        )
    else:
        new_settings = SystemSettings(portal_enabled=new_status, updated_by=current_user.id)
        await db.system_settings.insert_one(prepare_for_mongo(new_settings.dict()))
    
    status_text = "enabled" if new_status else "disabled"
    return {"message": f"Portal has been {status_text}", "portal_enabled": new_status}

@api_router.get("/employees/earnings")
async def get_employees_earnings(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can view employee earnings")
    
    employees = await db.users.find({"role": "employee"}).to_list(None)
    
    result = []
    for emp in employees:
        parsed_emp = parse_from_mongo(emp)
        
        # Get accepted assignments for payment tracking
        accepted_assignments = await db.assignments.find({
            "assigned_to": emp["id"],
            "status": "accepted"
        }).to_list(None)
        
        payment_details = []
        for assignment in accepted_assignments:
            parsed_assignment = parse_from_mongo(assignment)
            payment_details.append({
                "assignment_title": parsed_assignment["title"],
                "amount": parsed_assignment.get("amount", 0.0),
                "accepted_at": parsed_assignment.get("reviewed_at"),
                "payment_status": parsed_assignment.get("payment_status", "unpaid"),
                "paid_at": parsed_assignment.get("paid_at"),
                "assignment_id": parsed_assignment["id"]
            })
        
        result.append({
            "employee_id": emp["id"],
            "employee_name": emp["full_name"],
            "total_earnings": emp.get("total_earnings", 0),
            "pending_earnings": emp.get("pending_earnings", 0),
            "credited_earnings": emp.get("credited_earnings", 0),
            "payment_details": payment_details
        })
    
    return result

# Initialize admin user
@api_router.post("/init")
async def initialize_admin():
    # Check if admin exists
    admin = await db.users.find_one({"role": "admin"})
    if admin:
        return {"message": "Admin already exists"}
    
    # Create admin user
    admin_user = User(
        username="admin",
        email="admin@lifeline.com",
        role="admin",
        full_name="Administrator"
    )
    
    admin_data = prepare_for_mongo(admin_user.dict())
    admin_data["password"] = get_password_hash("admin")
    
    await db.users.insert_one(admin_data)
    
    # Initialize system settings
    settings = SystemSettings(updated_by=admin_user.id)
    await db.system_settings.insert_one(prepare_for_mongo(settings.dict()))
    
    return {"message": "Life Line's work portal initialized", "username": "admin", "password": "admin"}

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