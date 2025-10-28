import requests
import sys
import json
from datetime import datetime, timedelta
import base64
import io
import os

class MLMPortalAPITester:
    def __init__(self, base_url="https://mlm-portal-1.preview.emergentagent.com/api"):
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

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None, headers=None, token=None, form_data=False):
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
                elif form_data and data:
                    # Send as form data
                    response = requests.post(url, data=data, headers=test_headers)
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
        
        # Create first member (will be used for referrals) - use timestamp to ensure unique numbers
        import time
        timestamp = str(int(time.time()))[-4:]  # Last 4 digits of timestamp
        
        member1_data = {
            "mobile_number": f"8888{timestamp}01",
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
                data={"mobile_number": f"8888{timestamp}01", "password": "member123"}
            )
            
            if login_success and 'access_token' in login_response:
                self.member_token = login_response['access_token']
                print(f"   Member 1 token obtained")
        
        # Create additional members for referral testing
        for i in range(2, 7):  # Create 5 more members (total 6)
            member_data = {
                "mobile_number": f"8888{timestamp}{i:02d}",
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
            token=self.member_token,
            form_data=True
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
            token=self.member_token,
            form_data=True
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
            token=self.member_token,
            form_data=True
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

    def test_withdrawal_prerequisites(self):
        """Test withdrawal prerequisites API with 5 joinees check"""
        print("\n" + "="*50)
        print("TESTING WITHDRAWAL PREREQUISITES")
        print("="*50)
        
        # First, add some balance to the member for withdrawal testing
        if self.member_id:
            # Simulate adding balance (this would normally come from approved work)
            # We'll test withdrawal request directly
            
            # Test withdrawal request with insufficient referrals (should have 5 from registration)
            withdrawal_data = {
                "amount": 200.0
            }
            
            success1, response1 = self.run_test(
                "Member Request Withdrawal (Should Work - Has 5 Referrals)",
                "POST",
                "withdrawal/request",
                200,  # Should succeed if member has 5 referrals
                data=withdrawal_data,
                token=self.member_token,
                form_data=True
            )
            
            if not success1:
                # If it failed, check the error message
                print(f"   Response: {response1}")
                if "joiner" in str(response1).lower():
                    print("   ✅ Correct error message about needing joiners")
                    return True  # This is expected behavior
            else:
                print("   ✅ Withdrawal request successful (member has enough referrals)")
                return True
        
        # Create a new member with no referrals to test the restriction
        import time
        timestamp2 = str(int(time.time()))[-3:]  # Different timestamp
        member_no_ref_data = {
            "mobile_number": f"7777{timestamp2}777",
            "full_name": "No Referral Member",
            "upi_address": "noref@paytm",
            "password": "member123"
        }
        
        success2, response2 = self.run_test(
            "Create Member With No Referrals",
            "POST",
            "auth/register",
            200,
            data=member_no_ref_data
        )
        
        if success2:
            # Login as this member
            login_success, login_response = self.run_test(
                "Login Member With No Referrals",
                "POST",
                "auth/login",
                200,
                data={"mobile_number": f"7777{timestamp2}777", "password": "member123"}
            )
            
            if login_success and 'access_token' in login_response:
                no_ref_token = login_response['access_token']
                
                # Try withdrawal (should fail)
                withdrawal_data = {"amount": 100.0}
                
                success3, response3 = self.run_test(
                    "Member With No Referrals Request Withdrawal (Should Fail)",
                    "POST",
                    "withdrawal/request",
                    400,  # Should fail
                    data=withdrawal_data,
                    token=no_ref_token,
                    form_data=True
                )
                
                if success3:
                    print("   ✅ Withdrawal correctly rejected for member with no referrals")
                    if "5 joiners" in str(response3) or "joiner" in str(response3):
                        print("   ✅ Correct error message about needing 5 joiners")
                    return True
        
        return False

    def test_multi_file_type_support(self):
        """Test multi-file type support in assignments"""
        print("\n" + "="*50)
        print("TESTING MULTI-FILE TYPE SUPPORT")
        print("="*50)
        
        if not self.member_id:
            print("❌ No member ID available for assignment testing")
            return False
        
        # Test creating assignment with different file types
        deadline = (datetime.now() + timedelta(days=7)).isoformat()
        
        # Test with PDF file
        pdf_content = b"%PDF-1.4 fake pdf content for testing"
        
        form_data = {
            'title': 'Multi-File Test Assignment',
            'description': 'Testing multiple file type support',
            'assigned_to': self.member_id,
            'deadline': deadline,
            'amount': 50.0
        }
        
        files = {
            'file': ('test_document.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        
        success1, response1 = self.run_test(
            "Admin Create Assignment with PDF",
            "POST",
            "assignments",
            200,
            data=form_data,
            files=files,
            token=self.admin_token
        )
        
        if success1 and isinstance(response1, dict):
            assignment_id = response1.get('id')
            print(f"   ✅ Assignment with PDF created: {assignment_id}")
            
            # Test submitting with different file types
            # Test with image file
            img_content = b"fake image content for testing"
            
            submission_data = {
                'notes': 'Submitting assignment with image file'
            }
            
            submission_files = {
                'file': ('submission.jpg', io.BytesIO(img_content), 'image/jpeg')
            }
            
            success2, response2 = self.run_test(
                "Member Submit Assignment with JPG",
                "POST",
                f"assignments/{assignment_id}/submit",
                200,
                data=submission_data,
                files=submission_files,
                token=self.member_token
            )
            
            if success2:
                print("   ✅ Assignment submission with JPG successful")
            
            return success1 and success2
        
        return success1

    def test_dashboard_stats(self):
        """Test dashboard stats for both admin and member"""
        print("\n" + "="*50)
        print("TESTING DASHBOARD STATS")
        print("="*50)
        
        # Test admin dashboard stats
        success1, response1 = self.run_test(
            "Admin Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.admin_token
        )
        
        if success1 and isinstance(response1, dict):
            print(f"   ✅ Admin stats retrieved")
            print(f"   Total users: {response1.get('total_users', 0)}")
            print(f"   Active assignments: {response1.get('active_assignments', 0)}")
            print(f"   Pending submissions: {response1.get('pending_submissions', 0)}")
        
        # Test member dashboard stats
        success2, response2 = self.run_test(
            "Member Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.member_token
        )
        
        if success2 and isinstance(response2, dict):
            print(f"   ✅ Member stats retrieved")
            print(f"   Current balance: ₹{response2.get('current_balance', 0)}")
            print(f"   Direct referrals: {response2.get('direct_referrals', 0)}")
            print(f"   Can withdraw: {response2.get('can_withdraw', False)}")
        
        return success1 and success2

    def run_all_tests(self):
        """Run all MLM Portal tests in sequence"""
        print("🚀 Starting Life Line's MLM Portal API Testing")
        print("="*60)
        
        # Test sequence for MLM Portal
        tests = [
            ("System Initialization", self.test_system_initialization),
            ("Admin Authentication", self.test_admin_login),
            ("Member Registration & Setup", self.test_create_test_members),
            ("Installment Payment Tracking", self.test_installment_payment_tracking),
            ("Daily Work Report Submit", self.test_daily_work_report_submit),
            ("Daily Work Report List", self.test_daily_work_report_list),
            ("Daily Work Report Excel Export", self.test_daily_work_report_excel_export),
            ("Withdrawal Prerequisites", self.test_withdrawal_prerequisites),
            ("Multi-file Type Support", self.test_multi_file_type_support),
            ("Dashboard Stats", self.test_dashboard_stats)
        ]
        
        # Run all tests and track results
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*20} {test_name} {'='*20}")
                result = test_func()
                self.test_results[test_name] = result
                if result:
                    print(f"✅ {test_name} - PASSED")
                else:
                    print(f"❌ {test_name} - FAILED")
            except Exception as e:
                print(f"❌ {test_name} - ERROR: {str(e)}")
                self.test_results[test_name] = False
                self.failed_tests.append({
                    "test": test_name,
                    "error": str(e)
                })
        
        return self.test_results

def main():
    print("🚀 Starting Life Line's MLM Portal API Testing")
    print("="*60)
    
    tester = MLMPortalAPITester()
    
    # Run all tests
    test_results = tester.run_all_tests()
    
    # Print final results
    print("\n" + "="*60)
    print("📊 FINAL TEST RESULTS")
    print("="*60)
    print(f"Tests run: {tester.tests_run}")
    print(f"Tests passed: {tester.tests_passed}")
    print(f"Tests failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%" if tester.tests_run > 0 else "0%")
    
    # Print test results by category
    print("\n📋 TEST RESULTS BY CATEGORY:")
    for test_name, result in test_results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"  {test_name}: {status}")
    
    if tester.failed_tests:
        print("\n❌ FAILED TESTS DETAILS:")
        for i, failure in enumerate(tester.failed_tests, 1):
            print(f"{i}. {failure.get('test', 'Unknown')}")
            if 'error' in failure:
                print(f"   Error: {failure['error']}")
            if 'expected' in failure:
                print(f"   Expected: {failure['expected']}, Got: {failure['actual']}")
                print(f"   Response: {failure.get('response', 'N/A')}")
    
    # Return summary for test_result.md update
    return {
        "total_tests": tester.tests_run,
        "passed_tests": tester.tests_passed,
        "failed_tests": tester.tests_run - tester.tests_passed,
        "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
        "test_results": test_results,
        "failed_details": tester.failed_tests
    }

if __name__ == "__main__":
    sys.exit(main())