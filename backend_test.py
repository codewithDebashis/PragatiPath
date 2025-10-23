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

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.admin_token and 'admin' in name.lower():
            test_headers['Authorization'] = f'Bearer {self.admin_token}'
        elif self.employee_token and 'employee' in name.lower():
            test_headers['Authorization'] = f'Bearer {self.employee_token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for multipart/form-data
                    if 'Content-Type' in test_headers:
                        del test_headers['Content-Type']
                    response = requests.post(url, data=data, files=files, headers=test_headers)
                else:
                    response = requests.post(url, json=data, headers=test_headers)

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
                print(f"   Response: {response.text[:200]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
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
            data={"username": "admin", "password": "admin"}
        )
        
        if success and isinstance(response, dict) and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained: {self.admin_token[:20]}...")
            return True
        return False

    def test_dashboard_stats_admin(self):
        """Test admin dashboard stats"""
        success, response = self.run_test(
            "Admin Dashboard Stats",
            "GET",
            "dashboard/stats",
            200
        )
        
        if success and isinstance(response, dict):
            expected_keys = ['total_employees', 'total_assignments', 'pending_assignments', 'submitted_assignments']
            for key in expected_keys:
                if key not in response:
                    print(f"❌ Missing key in stats: {key}")
                    return False
            print(f"   Stats: {response}")
        return success

    def test_create_employee(self):
        """Test creating an employee"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE MANAGEMENT")
        print("="*50)
        
        employee_data = {
            "username": "testemployee",
            "email": "test@company.com",
            "password": "testpass123",
            "full_name": "Test Employee",
            "role": "employee"
        }
        
        success, response = self.run_test(
            "Admin Create Employee",
            "POST",
            "users",
            200,
            data=employee_data
        )
        
        if success and isinstance(response, dict) and 'id' in response:
            self.employee_id = response['id']
            print(f"   Employee created with ID: {self.employee_id}")
        return success

    def test_get_employees(self):
        """Test getting employees list"""
        success, response = self.run_test(
            "Admin Get Employees",
            "GET",
            "users",
            200
        )
        
        if success and isinstance(response, list):
            print(f"   Found {len(response)} employees")
            for emp in response:
                print(f"   - {emp.get('full_name', 'Unknown')} ({emp.get('username', 'Unknown')})")
        return success

    def test_employee_login(self):
        """Test employee login"""
        print("\n" + "="*50)
        print("TESTING EMPLOYEE AUTHENTICATION")
        print("="*50)
        
        success, response = self.run_test(
            "Employee Login",
            "POST",
            "auth/login",
            200,
            data={"username": "testemployee", "password": "testpass123"}
        )
        
        if success and isinstance(response, dict) and 'access_token' in response:
            self.employee_token = response['access_token']
            print(f"   Employee token obtained: {self.employee_token[:20]}...")
            return True
        return False

    def test_create_assignment(self):
        """Test creating work assignment with file attachment"""
        print("\n" + "="*50)
        print("TESTING WORK ASSIGNMENT CREATION")
        print("="*50)
        
        if not self.employee_id:
            print("❌ No employee ID available for assignment")
            return False
        
        # Create a test file
        test_file_content = b"This is a test assignment file content"
        
        deadline = (datetime.now() + timedelta(days=7)).isoformat()
        
        form_data = {
            'title': 'Test Assignment',
            'description': 'This is a test assignment with file attachment',
            'assigned_to': self.employee_id,
            'deadline': deadline
        }
        
        files = {
            'file': ('test_assignment.txt', io.BytesIO(test_file_content), 'text/plain')
        }
        
        success, response = self.run_test(
            "Admin Create Assignment",
            "POST",
            "assignments",
            200,
            data=form_data,
            files=files
        )
        
        if success and isinstance(response, dict) and 'id' in response:
            self.assignment_id = response['id']
            print(f"   Assignment created with ID: {self.assignment_id}")
        return success

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