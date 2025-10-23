import requests
import sys
import json
from datetime import datetime, timedelta
import base64
import io
import os

class MLMPortalAPITester:
    def __init__(self, base_url="https://mlm-network-9.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.member_id = None
        self.member2_id = None
        self.member3_id = None
        self.assignment_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.test_results = {}

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None, token=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {}
        
        if headers:
            test_headers.update(headers)
        
        # Set authorization token
        if token:
            test_headers['Authorization'] = f'Bearer {token}'
        elif self.admin_token and ('admin' in name.lower() or 'Admin' in name):
            test_headers['Authorization'] = f'Bearer {self.admin_token}'
        elif self.member_token and ('member' in name.lower() or 'Member' in name):
            test_headers['Authorization'] = f'Bearer {self.member_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Don't set Content-Type for multipart/form-data
                    response = requests.post(url, data=data, files=files, headers=test_headers)
                elif data and not files:
                    test_headers['Content-Type'] = 'application/json'
                    response = requests.post(url, json=data, headers=test_headers)
                else:
                    response = requests.post(url, headers=test_headers)

            print(f"   Status: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                try:
                    return success, response.json()
                except:
                    return success, response.text
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:300]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:300]
                })
                try:
                    return success, response.json()
                except:
                    return success, response.text

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_system_initialization(self):
        """Test system initialization"""
        print("\n" + "="*50)
        print("TESTING SYSTEM INITIALIZATION")
        print("="*50)
        
        success, response = self.run_test(
            "System Initialization",
            "POST",
            "init",
            200
        )
        
        if success:
            print("   ✅ System initialized with admin user")
        
        return success

    def test_admin_login(self):
        """Test admin login"""
        print("\n" + "="*50)
        print("TESTING ADMIN AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"mobile_number": "9999999999", "password": "admin123"}
        )
        
        if success and isinstance(response, dict) and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_create_test_members(self):
        """Create test members for testing"""
        print("\n" + "="*50)
        print("TESTING MEMBER REGISTRATION")
        print("="*50)
        
        # Create first member (will be used for referrals)
        member1_data = {
            "mobile_number": "8888888881",
            "full_name": "Rajesh Kumar",
            "upi_address": "rajesh@paytm",
            "password": "member123"
        }
        
        success1, response1 = self.run_test(
            "Create Member 1",
            "POST",
            "auth/register",
            200,
            data=member1_data
        )
        
        if success1 and isinstance(response1, dict) and 'user_id' in response1:
            self.member_id = response1['user_id']
            print(f"   Member 1 created with ID: {self.member_id}")
            print(f"   Referral code: {response1.get('referral_code', 'N/A')}")
            
            # Login as member 1
            login_success, login_response = self.run_test(
                "Member 1 Login",
                "POST",
                "auth/login",
                200,
                data={"mobile_number": "8888888881", "password": "member123"}
            )
            
            if login_success and 'access_token' in login_response:
                self.member_token = login_response['access_token']
                print(f"   Member 1 token obtained")
        
        # Create additional members for referral testing
        for i in range(2, 7):  # Create 5 more members (total 6)
            member_data = {
                "mobile_number": f"888888888{i}",
                "full_name": f"Test Member {i}",
                "upi_address": f"member{i}@paytm",
                "password": "member123",
                "referred_by_code": response1.get('referral_code') if success1 else None
            }
            
            success, response = self.run_test(
                f"Create Member {i} (Referral)",
                "POST",
                "auth/register",
                200,
                data=member_data
            )
            
            if i == 2 and success:
                self.member2_id = response.get('user_id')
            elif i == 3 and success:
                self.member3_id = response.get('user_id')
        
        return success1

    def test_installment_payment_tracking(self):
        """Test installment payment tracking API"""
        print("\n" + "="*50)
        print("TESTING INSTALLMENT PAYMENT TRACKING")
        print("="*50)
        
        if not self.member_id:
            print("❌ No member ID available for installment testing")
            return False
        
        # Test recording first installment
        installment_data = {
            "user_id": self.member_id,
            "installment_number": 1,
            "amount": 100.0
        }
        
        success, response = self.run_test(
            "Admin Record First Installment",
            "POST",
            f"admin/installment-payment/{self.member_id}",
            200,
            data=installment_data
        )
        
        if success and isinstance(response, dict):
            print(f"   ✅ First installment recorded")
            print(f"   Total paid: ₹{response.get('total_paid', 0)}")
            print(f"   Can work: {response.get('can_work', False)}")
            print(f"   Registration complete: {response.get('registration_complete', False)}")
            
            # Verify user can_work is now true
            if response.get('can_work'):
                print("   ✅ User can now work after first installment")
            else:
                print("   ❌ User should be able to work after first installment")
                return False
        
        # Test recording more installments to reach 500
        for i in range(2, 6):  # Installments 2-5
            installment_data = {
                "user_id": self.member_id,
                "installment_number": i,
                "amount": 100.0
            }
            
            success2, response2 = self.run_test(
                f"Admin Record Installment {i}",
                "POST",
                f"admin/installment-payment/{self.member_id}",
                200,
                data=installment_data
            )
            
            if success2 and i == 5:  # After 5th installment (500 total)
                print(f"   Total after 5 installments: ₹{response2.get('total_paid', 0)}")
                if response2.get('registration_complete'):
                    print("   ✅ Registration fee fully paid")
                else:
                    print("   ❌ Registration should be complete after ₹500")
        
        return success

    def test_daily_work_report_submit(self):
        """Test daily work report submission API"""
        print("\n" + "="*50)
        print("TESTING DAILY WORK REPORT SUBMISSION")
        print("="*50)
        
        # Test submission by member who can work
        report_data = {
            "date": "2025-01-15",
            "class_name": "Class 10th Science",
            "subject": "Physics - Light and Reflection",
            "details": "Taught concepts of reflection, refraction, and lens. Conducted practical experiments with mirrors and lenses. Students showed good understanding of the topic."
        }
        
        success, response = self.run_test(
            "Member Submit Daily Work Report",
            "POST",
            "daily-work-report",
            200,
            data=report_data,
            token=self.member_token
        )
        
        if success:
            print("   ✅ Daily work report submitted successfully")
        
        # Test updating existing report for same date
        updated_report_data = {
            "date": "2025-01-15",
            "class_name": "Class 10th Science",
            "subject": "Physics - Light and Reflection (Updated)",
            "details": "Updated: Taught concepts of reflection, refraction, and lens. Conducted practical experiments with mirrors and lenses. Added extra examples for better understanding."
        }
        
        success2, response2 = self.run_test(
            "Member Update Daily Work Report",
            "POST",
            "daily-work-report",
            200,
            data=updated_report_data,
            token=self.member_token
        )
        
        if success2:
            print("   ✅ Daily work report updated successfully")
        
        # Test submission for different date
        report_data2 = {
            "date": "2025-01-16",
            "class_name": "Class 9th Mathematics",
            "subject": "Algebra - Linear Equations",
            "details": "Explained solving linear equations in one variable. Practiced various problem types. Students completed worksheet exercises."
        }
        
        success3, response3 = self.run_test(
            "Member Submit Another Daily Report",
            "POST",
            "daily-work-report",
            200,
            data=report_data2,
            token=self.member_token
        )
        
        return success and success2 and success3

    def test_daily_work_report_list(self):
        """Test daily work report list API"""
        print("\n" + "="*50)
        print("TESTING DAILY WORK REPORT LIST")
        print("="*50)
        
        # Test admin viewing all reports
        success1, response1 = self.run_test(
            "Admin Get All Daily Work Reports",
            "GET",
            "daily-work-reports",
            200,
            token=self.admin_token
        )
        
        if success1 and isinstance(response1, list):
            print(f"   ✅ Admin sees {len(response1)} reports")
            for report in response1:
                print(f"   - {report.get('date')} | {report.get('user_name', 'Unknown')} | {report.get('class_name', 'Unknown')}")
        
        # Test member viewing only their reports
        success2, response2 = self.run_test(
            "Member Get Own Daily Work Reports",
            "GET",
            "daily-work-reports",
            200,
            token=self.member_token
        )
        
        if success2 and isinstance(response2, list):
            print(f"   ✅ Member sees {len(response2)} own reports")
            for report in response2:
                print(f"   - {report.get('date')} | {report.get('class_name', 'Unknown')} | {report.get('subject', 'Unknown')}")
        
        return success1 and success2

    def test_daily_work_report_excel_export(self):
        """Test daily work report Excel export API"""
        print("\n" + "="*50)
        print("TESTING DAILY WORK REPORT EXCEL EXPORT")
        print("="*50)
        
        # Test admin Excel export
        success, response = self.run_test(
            "Admin Export Daily Work Reports Excel",
            "GET",
            "admin/daily-work-reports/export",
            200,
            token=self.admin_token
        )
        
        if success:
            print("   ✅ Excel export successful")
            if isinstance(response, bytes) or len(str(response)) > 1000:
                print("   ✅ Response appears to be Excel file data")
            else:
                print(f"   ⚠️  Response might not be Excel file: {str(response)[:100]}")
        
        # Test member access (should be forbidden)
        success2, response2 = self.run_test(
            "Member Try Excel Export (Should Fail)",
            "GET",
            "admin/daily-work-reports/export",
            403,
            token=self.member_token
        )
        
        if success2:
            print("   ✅ Member correctly denied access to Excel export")
        
        return success and success2

    def test_get_assignments_admin(self):
        """Test getting assignments as admin"""
        success, response = self.run_test(
            "Admin Get Assignments",
            "GET",
            "assignments",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} assignments")
            for assignment in response:
                print(f"   - {assignment.get('title', 'Unknown')} -> {assignment.get('employee_name', 'Unknown')}")
        return success

    def test_get_assignments_employee(self):
        """Test getting assignments as employee"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE ASSIGNMENT ACCESS")
        print("="*50)
        
        success, response = self.run_test(
            "Employee Get Assignments",
            "GET",
            "assignments",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Employee sees {len(response)} assignments")
            for assignment in response:
                print(f"   - {assignment.get('title', 'Unknown')} (Status: {assignment.get('status', 'Unknown')})")
        return success

    def test_dashboard_stats_employee(self):
        """Test employee dashboard stats"""
        success, response = self.run_test(
            "Employee Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success and isinstance(response, dict):
            expected_keys = ['total_assignments', 'pending_assignments', 'submitted_assignments']
            for key in expected_keys:
                if key not in response:
                    print(f"❌ Missing key in employee stats: {key}")
                    return False
            print(f"   Employee Stats: {response}")
        return success

    def test_submit_assignment(self):
        """Test submitting assignment with file"""
        print("\n" + "="*50)
        print("TESTING ASSIGNMENT SUBMISSION")
        print("="*50)
        
        if not self.assignment_id:
            print("❌ No assignment ID available for submission")
            return False
        
        # Create a test submission file
        submission_content = b"This is my assignment submission"
        
        form_data = {
            'notes': 'This is my submission with notes'
        }
        
        files = {
            'file': ('submission.txt', io.BytesIO(submission_content), 'text/plain')
        }
        
        success, response = self.run_test(
            "Employee Submit Assignment",
            "POST",
            f"assignments/{self.assignment_id}/submit",
            200,
            data=form_data,
            files=files
        )
        return success

    def test_time_tracking(self):
        """Test time tracking functionality"""
        print("\n" + "="*50)
        print("TESTING TIME TRACKING")
        print("="*50)
        
        success, response = self.run_test(
            "Admin Get Time Tracking",
            "GET",
            "time-tracking",
            200
        )
        
        if success and isinstance(response, dict):
            print(f"   Time tracking data for {len(response)} users")
            for user_id, data in response.items():
                print(f"   - {data.get('user_name', 'Unknown')}: {len(data.get('daily_hours', {}))} days tracked")
        return success

    def test_logout_employee(self):
        """Test employee logout"""
        print("\n" + "="*50)
        print("TESTING LOGOUT FUNCTIONALITY")
        print("="*50)
        
        success, response = self.run_test(
            "Employee Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

    def test_logout_admin(self):
        """Test admin logout"""
        success, response = self.run_test(
            "Admin Logout",
            "POST",
            "auth/logout",
            200
        )
        return success

def main():
    print("🚀 Starting Task Tracker API Testing")
    print("="*60)
    
    tester = TaskTrackerAPITester()
    
    # Test sequence
    tests = [
        tester.test_system_initialization,
        tester.test_admin_login,
        tester.test_dashboard_stats_admin,
        tester.test_create_employee,
        tester.test_get_employees,
        tester.test_employee_login,
        tester.test_dashboard_stats_employee,
        tester.test_create_assignment,
        tester.test_get_assignments_admin,
        tester.test_get_assignments_employee,
        tester.test_submit_assignment,
        tester.test_time_tracking,
        tester.test_logout_employee,
        tester.test_logout_admin
    ]
    
    # Run all tests
    for test in tests:
        try:
            test()
        except Exception as e:
            print(f"❌ Test failed with exception: {str(e)}")
            tester.failed_tests.append({
                "test": test.__name__,
                "error": str(e)
            })
    
    # Print final results
    print("\n" + "="*60)
    print("📊 FINAL TEST RESULTS")
    print("="*60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"{i}. {failure.get('test', 'Unknown')}")
            if 'error' in failure:
                print(f"   Error: {failure['error']}")
            if 'expected' in failure:
                print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                print(f"   Response: {failure.get('response', 'N/A')}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())