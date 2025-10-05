from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File, Form, status
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
from datetime import datetime, timezone
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
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="Employee Work Management System")

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
    attachment_name: Optional[str] = None
    attachment_data: Optional[str] = None  # base64 encoded file
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = "pending"  # "pending", "submitted", "completed"

class WorkAssignmentCreate(BaseModel):
    title: str
    description: str
    assigned_to: str
    deadline: str  # ISO format string

class WorkSubmission(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    assignment_id: str
    submitted_by: str
    submission_file_name: Optional[str] = None
    submission_file_data: Optional[str] = None  # base64 encoded
    notes: Optional[str] = None
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TimeTrackingSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    start_time: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    end_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).date().isoformat())

# Helper functions
def prepare_for_mongo(data):
    """Convert datetime objects to ISO strings for MongoDB storage"""
    if isinstance(data, dict):
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

def parse_from_mongo(item):
    """Convert ISO strings back to datetime objects"""
    if isinstance(item, dict):
        for key, value in item.items():
            if isinstance(value, str) and key.endswith('_at') or key.endswith('_time'):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
            elif key == 'deadline' and isinstance(value, str):
                try:
                    item[key] = datetime.fromisoformat(value)
                except:
                    pass
    return item

def verify_password(plain_password, hashed_password):
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(plain_password.encode('utf-8')) > 72:
        plain_password = plain_password[:72]
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    # Truncate password to 72 bytes for bcrypt compatibility
    if len(password.encode('utf-8')) > 72:
        password = password[:72]
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

# Routes
@api_router.get("/")
async def root():
    return {"message": "Employee Work Management API"}

@api_router.post("/auth/login")
async def login(user_login: UserLogin):
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
        "deadline": datetime.fromisoformat(deadline.replace('Z', '+00:00'))
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
    
    submission_data = {
        "assignment_id": assignment_id,
        "submitted_by": current_user.id,
        "notes": notes
    }
    
    if file:
        file_content = await file.read()
        submission_data["submission_file_name"] = file.filename
        submission_data["submission_file_data"] = base64.b64encode(file_content).decode('utf-8')
    
    submission = WorkSubmission(**submission_data)
    await db.submissions.insert_one(prepare_for_mongo(submission.dict()))
    
    # Update assignment status
    await db.assignments.update_one(
        {"id": assignment_id},
        {"$set": {"status": "submitted"}}
    )
    
    return {"message": "Assignment submitted successfully"}

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
        pending_assignments = await db.assignments.count_documents({"status": "pending"})
        submitted_assignments = await db.assignments.count_documents({"status": "submitted"})
        
        return {
            "total_employees": total_employees,
            "total_assignments": total_assignments,
            "pending_assignments": pending_assignments,
            "submitted_assignments": submitted_assignments
        }
    else:
        my_assignments = await db.assignments.count_documents({"assigned_to": current_user.id})
        pending_assignments = await db.assignments.count_documents({
            "assigned_to": current_user.id,
            "status": "pending"
        })
        submitted_assignments = await db.assignments.count_documents({
            "assigned_to": current_user.id,
            "status": "submitted"
        })
        
        return {
            "total_assignments": my_assignments,
            "pending_assignments": pending_assignments,
            "submitted_assignments": submitted_assignments
        }

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
        email="admin@company.com",
        role="admin",
        full_name="Administrator"
    )
    
    admin_data = prepare_for_mongo(admin_user.dict())
    admin_data["password"] = get_password_hash("admin")
    
    await db.users.insert_one(admin_data)
    return {"message": "Admin user created", "username": "admin", "password": "admin"}

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