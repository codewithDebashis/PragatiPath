import requests
import json
import base64
import io
from datetime import datetime, timedelta
import time

class AdminDownloadWorkTester:
    def __init__(self, base_url="https://mlm-portal-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.member_id = None
        self.assignment_id = None
        self.submission_id = None
        
    def log(self, message):
        """Log message with timestamp"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")
        
    def make_request(self, method, endpoint, data=None, files=None, token=None, form_data=False):
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/{endpoint}"
        headers = {}
        
        if token:
            headers['Authorization'] = f'Bearer {token}'
            
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Don't set Content-Type for multipart/form-data
                    response = requests.post(url, data=data, files=files, headers=headers)
                elif form_data and data:
                    response = requests.post(url, data=data, headers=headers)
                elif data and not files:
                    headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=headers)
                else:
                    response = requests.post(url, headers=headers)
            
            self.log(f"{method} {endpoint} -> {response.status_code}")
            return response
            
        except Exception as e:
            self.log(f"❌ Request failed: {str(e)}")
            return None
    
    def setup_system(self):
        """Initialize system and login as admin"""
        self.log("🔧 Setting up system...")
        
        # Initialize system
        response = self.make_request("POST", "init")
        if response and response.status_code == 200:
            self.log("✅ System initialized")
        
        # Login as admin
        response = self.make_request("POST", "auth/login", data={
            "mobile_number": "9999999999",
            "password": "admin123"
        })
        
        if response and response.status_code == 200:
            data = response.json()
            self.admin_token = data.get('access_token')
            self.log("✅ Admin logged in successfully")
            return True
        else:
            self.log("❌ Admin login failed")
            return False
    
    def create_test_member(self):
        """Create a test member for work submission"""
        self.log("👤 Creating test member...")
        
        # Use timestamp to ensure unique mobile number
        timestamp = str(int(time.time()))[-6:]
        mobile = f"9876{timestamp}"
        
        member_data = {
            "mobile_number": mobile,
            "full_name": "Priya Sharma",
            "upi_address": "priya@paytm",
            "password": "member123"
        }
        
        response = self.make_request("POST", "auth/register", data=member_data)
        
        if response and response.status_code == 200:
            data = response.json()
            self.member_id = data.get('user_id')
            self.log(f"✅ Member created: {data.get('full_name')} (ID: {self.member_id})")
            
            # Login as member
            login_response = self.make_request("POST", "auth/login", data={
                "mobile_number": mobile,
                "password": "member123"
            })
            
            if login_response and login_response.status_code == 200:
                login_data = login_response.json()
                self.member_token = login_data.get('access_token')
                self.log("✅ Member logged in successfully")
                return True
        
        self.log("❌ Member creation failed")
        return False
    
    def record_installment(self):
        """Record installment payment so member can work"""
        self.log("💰 Recording installment payment...")
        
        installment_data = {
            "user_id": self.member_id,
            "installment_number": 1,
            "amount": 150.0
        }
        
        response = self.make_request(
            "POST", 
            f"admin/installment-payment/{self.member_id}",
            data=installment_data,
            token=self.admin_token
        )
        
        if response and response.status_code == 200:
            data = response.json()
            self.log(f"✅ Installment recorded: ₹{data.get('total_paid', 0)} paid")
            self.log(f"   Can work: {data.get('can_work', False)}")
            return data.get('can_work', False)
        
        self.log("❌ Installment recording failed")
        return False
    
    def create_assignment(self):
        """Create assignment and assign to member"""
        self.log("📋 Creating assignment...")
        
        deadline = (datetime.now() + timedelta(days=7)).isoformat()
        
        # Create a sample PDF file for assignment
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF"
        
        form_data = {
            'title': 'Mathematics Teaching Assignment',
            'description': 'Prepare and teach Class 10 Mathematics - Quadratic Equations chapter. Submit lesson plan and student feedback.',
            'assigned_to': self.member_id,
            'deadline': deadline,
            'amount': 300.0
        }
        
        files = {
            'file': ('assignment_guidelines.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        response = self.make_request(
            "POST",
            "assignments",
            data=form_data,
            files=files,
            token=self.admin_token
        )
        
        if response and response.status_code == 200:
            data = response.json()
            self.assignment_id = data.get('id')
            self.log(f"✅ Assignment created: {form_data['title']}")
            self.log(f"   Assignment ID: {self.assignment_id}")
            self.log(f"   Amount: ₹{form_data['amount']}")
            return True
        
        self.log("❌ Assignment creation failed")
        if response:
            self.log(f"   Response: {response.text}")
        return False
    
    def submit_assignment_with_file(self):
        """Member submits assignment with file attachment"""
        self.log("📤 Member submitting assignment with file...")
        
        # Create a sample image file for submission
        # This is a minimal PNG file (1x1 pixel transparent)
        png_content = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU8qAAAAAElFTkSuQmCC"
        )
        
        submission_data = {
            'notes': 'I have completed the Mathematics teaching assignment. Attached is the lesson plan document with student feedback and assessment results. The students showed good understanding of quadratic equations and were able to solve practice problems successfully.'
        }
        
        files = {
            'file': ('lesson_plan_feedback.png', io.BytesIO(png_content), 'image/png')
        }
        
        response = self.make_request(
            "POST",
            f"assignments/{self.assignment_id}/submit",
            data=submission_data,
            files=files,
            token=self.member_token
        )
        
        if response and response.status_code == 200:
            self.log("✅ Assignment submitted with file attachment")
            self.log(f"   Notes: {submission_data['notes'][:50]}...")
            self.log(f"   File: lesson_plan_feedback.png")
            return True
        
        self.log("❌ Assignment submission failed")
        if response:
            self.log(f"   Response: {response.text}")
        return False
    
    def test_admin_submissions_api(self):
        """Test the main focus: /api/admin/submissions endpoint"""
        self.log("🎯 Testing /api/admin/submissions endpoint...")
        
        response = self.make_request("GET", "admin/submissions", token=self.admin_token)
        
        if not response or response.status_code != 200:
            self.log("❌ Failed to get admin submissions")
            if response:
                self.log(f"   Response: {response.text}")
            return False
        
        try:
            submissions = response.json()
            self.log(f"✅ Retrieved {len(submissions)} submissions")
            
            # Find submission with file attachment
            submission_with_file = None
            for submission in submissions:
                if submission.get('file_name') and submission.get('file_data'):
                    submission_with_file = submission
                    break
            
            if not submission_with_file:
                self.log("❌ No submission found with file attachment")
                return False
            
            # CRITICAL CHECK: Verify field names
            self.log("\n🔍 CRITICAL FIELD VERIFICATION:")
            self.log("="*50)
            
            # Check for correct field names
            has_file_name = 'file_name' in submission_with_file
            has_file_data = 'file_data' in submission_with_file
            
            # Check for old field names (should NOT be present in response)
            has_old_file_name = 'submission_file_name' in submission_with_file
            has_old_file_data = 'submission_file_data' in submission_with_file
            
            self.log(f"✅ file_name field present: {has_file_name}")
            self.log(f"✅ file_data field present: {has_file_data}")
            self.log(f"❌ submission_file_name field present: {has_old_file_name}")
            self.log(f"❌ submission_file_data field present: {has_old_file_data}")
            
            if has_file_name and has_file_data:
                self.log("\n🎉 SUCCESS: Backend returns correct field names!")
                self.log("   Frontend download button condition will pass: submission.file_name exists")
            else:
                self.log("\n❌ FAILURE: Backend not returning correct field names!")
                return False
            
            # Print sample submission structure
            self.log("\n📋 SAMPLE SUBMISSION STRUCTURE:")
            self.log("="*50)
            sample_fields = {
                'id': submission_with_file.get('id'),
                'user_name': submission_with_file.get('user_name'),
                'assignment_title': submission_with_file.get('assignment_title'),
                'file_name': submission_with_file.get('file_name'),
                'file_data': f"{len(submission_with_file.get('file_data', ''))} characters" if submission_with_file.get('file_data') else None,
                'status': submission_with_file.get('status'),
                'submitted_at': submission_with_file.get('submitted_at')
            }
            
            for field, value in sample_fields.items():
                self.log(f"  {field}: {value}")
            
            # Verify file_name is not empty
            file_name = submission_with_file.get('file_name')
            if file_name and file_name.strip():
                self.log(f"\n✅ file_name has valid value: '{file_name}'")
                self.log("   Frontend download button will be visible!")
            else:
                self.log(f"\n❌ file_name is empty or invalid: '{file_name}'")
                return False
            
            return True
            
        except Exception as e:
            self.log(f"❌ Error parsing submissions response: {str(e)}")
            return False
    
    def run_complete_test(self):
        """Run the complete admin download work test"""
        self.log("🚀 Starting Admin Download Work Feature Test")
        self.log("="*60)
        
        # Step 1: Setup and Submit Work
        self.log("\n📋 STEP 1: SETUP AND SUBMIT WORK")
        self.log("-" * 40)
        
        if not self.setup_system():
            return False
        
        if not self.create_test_member():
            return False
        
        if not self.record_installment():
            return False
        
        if not self.create_assignment():
            return False
        
        if not self.submit_assignment_with_file():
            return False
        
        # Step 2: Test Admin Download Feature
        self.log("\n🎯 STEP 2: TEST ADMIN DOWNLOAD FEATURE (MAIN FOCUS)")
        self.log("-" * 50)
        
        success = self.test_admin_submissions_api()
        
        # Final Summary
        self.log("\n" + "="*60)
        self.log("📊 FINAL TEST RESULTS")
        self.log("="*60)
        
        if success:
            self.log("🎉 ✅ ADMIN DOWNLOAD WORK FEATURE TEST PASSED!")
            self.log("   ✅ Backend returns file_name field (not submission_file_name)")
            self.log("   ✅ Backend returns file_data field (not submission_file_data)")
            self.log("   ✅ Frontend download button condition will pass")
            self.log("   ✅ Download button will be visible in UI")
        else:
            self.log("❌ ADMIN DOWNLOAD WORK FEATURE TEST FAILED!")
            self.log("   ❌ Backend field mapping issue detected")
            self.log("   ❌ Frontend download button may not appear")
        
        return success

def main():
    """Main test execution"""
    tester = AdminDownloadWorkTester()
    success = tester.run_complete_test()
    
    if success:
        print("\n🎉 All tests passed! Admin download work feature is working correctly.")
        return 0
    else:
        print("\n❌ Tests failed! Admin download work feature needs attention.")
        return 1

if __name__ == "__main__":
    exit(main())