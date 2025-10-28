import requests
import sys
import json
from datetime import datetime, timedelta
import base64
import io
import os
import time

class SplitPaymentAPITester:
    def __init__(self, base_url="https://mlm-portal-1.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.admin_token = None
        self.member_token = None
        self.member_id = None
        self.assignment_id = None
        self.submission_id = None
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
                print(f"   Response: {response.text[:500]}...")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:500]
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

    def setup_test_environment(self):
        """Setup test environment with admin, member, and assignment"""
        print("\n" + "="*50)
        print("SETTING UP TEST ENVIRONMENT")
        print("="*50)
        
        # Initialize system
        success, response = self.run_test(
            "System Initialization",
            "POST",
            "init",
            200
        )
        
        # Admin login
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"mobile_number": "9999999999", "password": "admin123"}
        )
        
        if success and isinstance(response, dict) and 'access_token' in response:
            self.admin_token = response['access_token']
            print(f"   Admin token obtained")
        else:
            print("❌ Failed to get admin token")
            return False
        
        # Create test member
        timestamp = str(int(time.time()))[-4:]
        member_data = {
            "mobile_number": f"8888{timestamp}01",
            "full_name": "Priya Sharma",
            "upi_address": "priya@paytm",
            "password": "member123"
        }
        
        success, response = self.run_test(
            "Create Test Member",
            "POST",
            "auth/register",
            200,
            data=member_data
        )
        
        if success and isinstance(response, dict) and 'user_id' in response:
            self.member_id = response['user_id']
            print(f"   Member created with ID: {self.member_id}")
            
            # Login as member
            login_success, login_response = self.run_test(
                "Member Login",
                "POST",
                "auth/login",
                200,
                data={"mobile_number": f"8888{timestamp}01", "password": "member123"}
            )
            
            if login_success and 'access_token' in login_response:
                self.member_token = login_response['access_token']
                print(f"   Member token obtained")
            else:
                print("❌ Failed to get member token")
                return False
        else:
            print("❌ Failed to create member")
            return False
        
        # Record installment so member can work
        installment_data = {
            "user_id": self.member_id,
            "installment_number": 1,
            "amount": 100.0
        }
        
        success, response = self.run_test(
            "Record Member Installment",
            "POST",
            f"admin/installment-payment/{self.member_id}",
            200,
            data=installment_data,
            token=self.admin_token
        )
        
        if not success:
            print("❌ Failed to record installment")
            return False
        
        # Create assignment
        deadline = (datetime.now() + timedelta(days=7)).isoformat()
        assignment_data = {
            'title': 'Split Payment Test Assignment',
            'description': 'Testing split payment functionality',
            'assigned_to': self.member_id,
            'deadline': deadline,
            'amount': 300.0  # Rs 300 for split testing
        }
        
        success, response = self.run_test(
            "Create Test Assignment",
            "POST",
            "assignments",
            200,
            data=assignment_data,
            token=self.admin_token,
            form_data=True
        )
        
        if success and isinstance(response, dict):
            self.assignment_id = response.get('id')
            print(f"   Assignment created with ID: {self.assignment_id}")
        else:
            print("❌ Failed to create assignment")
            return False
        
        # Submit assignment
        submission_data = {
            'notes': 'Completed the assignment work as requested'
        }
        
        # Create a simple text file for submission
        file_content = b"Assignment submission content - split payment test"
        submission_files = {
            'file': ('submission.txt', io.BytesIO(file_content), 'text/plain')
        }
        
        success, response = self.run_test(
            "Submit Assignment",
            "POST",
            f"assignments/{self.assignment_id}/submit",
            200,
            data=submission_data,
            files=submission_files,
            token=self.member_token
        )
        
        if success:
            print("   Assignment submitted successfully")
            
            # Get submission ID by fetching submissions
            success, submissions = self.run_test(
                "Get Submissions",
                "GET",
                "admin/submissions",
                200,
                token=self.admin_token
            )
            
            if success and isinstance(submissions, list) and len(submissions) > 0:
                # Find our submission
                for sub in submissions:
                    if sub.get('assignment_id') == self.assignment_id:
                        self.submission_id = sub.get('id')
                        print(f"   Submission ID: {self.submission_id}")
                        break
        else:
            print("❌ Failed to submit assignment")
            return False
        
        return True

    def test_split_payment_api(self):
        """Test split payment API - HIGH PRIORITY"""
        print("\n" + "="*50)
        print("TESTING SPLIT PAYMENT API (HIGH PRIORITY)")
        print("="*50)
        
        if not self.submission_id:
            print("❌ No submission ID available for split payment testing")
            return False
        
        # Get member stats before payment
        success, before_stats = self.run_test(
            "Get Member Stats Before Split Payment",
            "GET",
            "dashboard/stats",
            200,
            token=self.member_token
        )
        
        if success:
            before_balance = before_stats.get('current_balance', 0)
            before_contribution = before_stats.get('total_installments_paid', 0)
            before_total_earnings = before_stats.get('total_earnings', 0)
            print(f"   Before - Balance: ₹{before_balance}, Contribution: ₹{before_contribution}, Total Earnings: ₹{before_total_earnings}")
        
        # Test split payment: Rs 200 to wallet, Rs 100 to contribution
        split_data = {
            'action': 'approve',
            'payment_destination': 'split',
            'wallet_amount': 200.0,
            'contribution_amount': 100.0,
            'comments': 'Split payment test - Rs 200 wallet + Rs 100 contribution'
        }
        
        success, response = self.run_test(
            "Admin Approve with Split Payment (Rs 200 wallet + Rs 100 contribution)",
            "POST",
            f"submissions/{self.submission_id}/review",
            200,
            data=split_data,
            token=self.admin_token,
            form_data=True
        )
        
        if success:
            print("   ✅ Split payment approval successful")
            
            # Get member stats after payment
            success2, after_stats = self.run_test(
                "Get Member Stats After Split Payment",
                "GET",
                "dashboard/stats",
                200,
                token=self.member_token
            )
            
            if success2:
                after_balance = after_stats.get('current_balance', 0)
                after_contribution = after_stats.get('total_installments_paid', 0)
                after_total_earnings = after_stats.get('total_earnings', 0)
                
                print(f"   After - Balance: ₹{after_balance}, Contribution: ₹{after_contribution}, Total Earnings: ₹{after_total_earnings}")
                
                # Verify split payment calculations
                balance_increase = after_balance - before_balance
                contribution_increase = after_contribution - before_contribution
                earnings_increase = after_total_earnings - before_total_earnings
                
                print(f"   Changes - Balance: +₹{balance_increase}, Contribution: +₹{contribution_increase}, Total Earnings: +₹{earnings_increase}")
                
                # Critical validations
                wallet_correct = abs(balance_increase - 200.0) < 0.01
                contribution_correct = abs(contribution_increase - 100.0) < 0.01
                total_earnings_correct = abs(earnings_increase - 300.0) < 0.01  # Should be full amount
                
                if wallet_correct:
                    print("   ✅ Wallet amount correctly increased by ₹200")
                else:
                    print(f"   ❌ Wallet amount incorrect - Expected +₹200, got +₹{balance_increase}")
                
                if contribution_correct:
                    print("   ✅ Contribution amount correctly increased by ₹100")
                else:
                    print(f"   ❌ Contribution amount incorrect - Expected +₹100, got +₹{contribution_increase}")
                
                if total_earnings_correct:
                    print("   ✅ Total earnings correctly increased by ₹300 (full amount)")
                else:
                    print(f"   ❌ Total earnings incorrect - Expected +₹300, got +₹{earnings_increase}")
                
                return wallet_correct and contribution_correct and total_earnings_correct
            
        return success

    def test_full_payment_to_contribution(self):
        """Test full payment to contribution - HIGH PRIORITY"""
        print("\n" + "="*50)
        print("TESTING FULL PAYMENT TO CONTRIBUTION (HIGH PRIORITY)")
        print("="*50)
        
        # Create another assignment and submission for this test
        deadline = (datetime.now() + timedelta(days=7)).isoformat()
        assignment_data = {
            'title': 'Contribution Payment Test Assignment',
            'description': 'Testing full payment to contribution',
            'assigned_to': self.member_id,
            'deadline': deadline,
            'amount': 150.0  # Rs 150 for contribution testing
        }
        
        success, response = self.run_test(
            "Create Assignment for Contribution Test",
            "POST",
            "assignments",
            200,
            data=assignment_data,
            token=self.admin_token,
            form_data=True
        )
        
        if not success:
            print("❌ Failed to create assignment for contribution test")
            return False
        
        assignment_id2 = response.get('id')
        
        # Submit assignment
        submission_data = {
            'notes': 'Assignment for contribution payment test'
        }
        
        file_content = b"Assignment submission for contribution test"
        submission_files = {
            'file': ('contribution_test.txt', io.BytesIO(file_content), 'text/plain')
        }
        
        success, response = self.run_test(
            "Submit Assignment for Contribution Test",
            "POST",
            f"assignments/{assignment_id2}/submit",
            200,
            data=submission_data,
            files=submission_files,
            token=self.member_token
        )
        
        if not success:
            print("❌ Failed to submit assignment for contribution test")
            return False
        
        # Get submission ID
        success, submissions = self.run_test(
            "Get Submissions for Contribution Test",
            "GET",
            "admin/submissions",
            200,
            token=self.admin_token
        )
        
        submission_id2 = None
        if success and isinstance(submissions, list):
            for sub in submissions:
                if sub.get('assignment_id') == assignment_id2:
                    submission_id2 = sub.get('id')
                    break
        
        if not submission_id2:
            print("❌ Could not find submission ID for contribution test")
            return False
        
        # Get member stats before payment
        success, before_stats = self.run_test(
            "Get Member Stats Before Contribution Payment",
            "GET",
            "dashboard/stats",
            200,
            token=self.member_token
        )
        
        if success:
            before_balance = before_stats.get('current_balance', 0)
            before_contribution = before_stats.get('total_installments_paid', 0)
            before_total_earnings = before_stats.get('total_earnings', 0)
            print(f"   Before - Balance: ₹{before_balance}, Contribution: ₹{before_contribution}, Total Earnings: ₹{before_total_earnings}")
        
        # Test full payment to contribution
        contribution_data = {
            'action': 'approve',
            'payment_destination': 'contribution',
            'comments': 'Full payment to contribution test - Rs 150'
        }
        
        success, response = self.run_test(
            "Admin Approve with Full Payment to Contribution (Rs 150)",
            "POST",
            f"submissions/{submission_id2}/review",
            200,
            data=contribution_data,
            token=self.admin_token,
            form_data=True
        )
        
        if success:
            print("   ✅ Full payment to contribution approval successful")
            
            # Get member stats after payment
            success2, after_stats = self.run_test(
                "Get Member Stats After Contribution Payment",
                "GET",
                "dashboard/stats",
                200,
                token=self.member_token
            )
            
            if success2:
                after_balance = after_stats.get('current_balance', 0)
                after_contribution = after_stats.get('total_installments_paid', 0)
                after_total_earnings = after_stats.get('total_earnings', 0)
                
                print(f"   After - Balance: ₹{after_balance}, Contribution: ₹{after_contribution}, Total Earnings: ₹{after_total_earnings}")
                
                # Verify contribution payment calculations
                balance_change = after_balance - before_balance
                contribution_increase = after_contribution - before_contribution
                earnings_increase = after_total_earnings - before_total_earnings
                
                print(f"   Changes - Balance: +₹{balance_change}, Contribution: +₹{contribution_increase}, Total Earnings: +₹{earnings_increase}")
                
                # Critical validations
                balance_unchanged = abs(balance_change) < 0.01  # Should not change
                contribution_correct = abs(contribution_increase - 150.0) < 0.01
                total_earnings_correct = abs(earnings_increase - 150.0) < 0.01
                
                if balance_unchanged:
                    print("   ✅ Wallet balance correctly unchanged")
                else:
                    print(f"   ❌ Wallet balance should not change - Changed by ₹{balance_change}")
                
                if contribution_correct:
                    print("   ✅ Contribution correctly increased by ₹150")
                else:
                    print(f"   ❌ Contribution incorrect - Expected +₹150, got +₹{contribution_increase}")
                
                if total_earnings_correct:
                    print("   ✅ Total earnings correctly increased by ₹150")
                else:
                    print(f"   ❌ Total earnings incorrect - Expected +₹150, got +₹{earnings_increase}")
                
                return balance_unchanged and contribution_correct and total_earnings_correct
        
        return success

    def test_full_payment_to_wallet(self):
        """Test full payment to wallet - HIGH PRIORITY"""
        print("\n" + "="*50)
        print("TESTING FULL PAYMENT TO WALLET (HIGH PRIORITY)")
        print("="*50)
        
        # Create another assignment and submission for this test
        deadline = (datetime.now() + timedelta(days=7)).isoformat()
        assignment_data = {
            'title': 'Wallet Payment Test Assignment',
            'description': 'Testing full payment to wallet',
            'assigned_to': self.member_id,
            'deadline': deadline,
            'amount': 250.0  # Rs 250 for wallet testing
        }
        
        success, response = self.run_test(
            "Create Assignment for Wallet Test",
            "POST",
            "assignments",
            200,
            data=assignment_data,
            token=self.admin_token,
            form_data=True
        )
        
        if not success:
            print("❌ Failed to create assignment for wallet test")
            return False
        
        assignment_id3 = response.get('id')
        
        # Submit assignment
        submission_data = {
            'notes': 'Assignment for wallet payment test'
        }
        
        file_content = b"Assignment submission for wallet test"
        submission_files = {
            'file': ('wallet_test.txt', io.BytesIO(file_content), 'text/plain')
        }
        
        success, response = self.run_test(
            "Submit Assignment for Wallet Test",
            "POST",
            f"assignments/{assignment_id3}/submit",
            200,
            data=submission_data,
            files=submission_files,
            token=self.member_token
        )
        
        if not success:
            print("❌ Failed to submit assignment for wallet test")
            return False
        
        # Get submission ID
        success, submissions = self.run_test(
            "Get Submissions for Wallet Test",
            "GET",
            "admin/submissions",
            200,
            token=self.admin_token
        )
        
        submission_id3 = None
        if success and isinstance(submissions, list):
            for sub in submissions:
                if sub.get('assignment_id') == assignment_id3:
                    submission_id3 = sub.get('id')
                    break
        
        if not submission_id3:
            print("❌ Could not find submission ID for wallet test")
            return False
        
        # Get member stats before payment
        success, before_stats = self.run_test(
            "Get Member Stats Before Wallet Payment",
            "GET",
            "dashboard/stats",
            200,
            token=self.member_token
        )
        
        if success:
            before_balance = before_stats.get('current_balance', 0)
            before_contribution = before_stats.get('total_installments_paid', 0)
            before_total_earnings = before_stats.get('total_earnings', 0)
            print(f"   Before - Balance: ₹{before_balance}, Contribution: ₹{before_contribution}, Total Earnings: ₹{before_total_earnings}")
        
        # Test full payment to wallet
        wallet_data = {
            'action': 'approve',
            'payment_destination': 'wallet',
            'comments': 'Full payment to wallet test - Rs 250'
        }
        
        success, response = self.run_test(
            "Admin Approve with Full Payment to Wallet (Rs 250)",
            "POST",
            f"submissions/{submission_id3}/review",
            200,
            data=wallet_data,
            token=self.admin_token,
            form_data=True
        )
        
        if success:
            print("   ✅ Full payment to wallet approval successful")
            
            # Get member stats after payment
            success2, after_stats = self.run_test(
                "Get Member Stats After Wallet Payment",
                "GET",
                "dashboard/stats",
                200,
                token=self.member_token
            )
            
            if success2:
                after_balance = after_stats.get('current_balance', 0)
                after_contribution = after_stats.get('total_installments_paid', 0)
                after_total_earnings = after_stats.get('total_earnings', 0)
                
                print(f"   After - Balance: ₹{after_balance}, Contribution: ₹{after_contribution}, Total Earnings: ₹{after_total_earnings}")
                
                # Verify wallet payment calculations
                balance_increase = after_balance - before_balance
                contribution_change = after_contribution - before_contribution
                earnings_increase = after_total_earnings - before_total_earnings
                
                print(f"   Changes - Balance: +₹{balance_increase}, Contribution: +₹{contribution_change}, Total Earnings: +₹{earnings_increase}")
                
                # Critical validations
                balance_correct = abs(balance_increase - 250.0) < 0.01
                contribution_unchanged = abs(contribution_change) < 0.01  # Should not change
                total_earnings_correct = abs(earnings_increase - 250.0) < 0.01
                
                if balance_correct:
                    print("   ✅ Wallet balance correctly increased by ₹250")
                else:
                    print(f"   ❌ Wallet balance incorrect - Expected +₹250, got +₹{balance_increase}")
                
                if contribution_unchanged:
                    print("   ✅ Contribution correctly unchanged")
                else:
                    print(f"   ❌ Contribution should not change - Changed by ₹{contribution_change}")
                
                if total_earnings_correct:
                    print("   ✅ Total earnings correctly increased by ₹250")
                else:
                    print(f"   ❌ Total earnings incorrect - Expected +₹250, got +₹{earnings_increase}")
                
                return balance_correct and contribution_unchanged and total_earnings_correct
        
        return success

    def test_dashboard_stats_total_earnings(self):
        """Test dashboard stats API - verify total_earnings reflects ALL payments - HIGH PRIORITY"""
        print("\n" + "="*50)
        print("TESTING DASHBOARD STATS - TOTAL EARNINGS VERIFICATION (HIGH PRIORITY)")
        print("="*50)
        
        # Get final member stats
        success, final_stats = self.run_test(
            "Get Final Member Dashboard Stats",
            "GET",
            "dashboard/stats",
            200,
            token=self.member_token
        )
        
        if success:
            current_balance = final_stats.get('current_balance', 0)
            total_installments_paid = final_stats.get('total_installments_paid', 0)
            total_earnings = final_stats.get('total_earnings', 0)
            
            print(f"   Final Stats:")
            print(f"   - Current Balance: ₹{current_balance}")
            print(f"   - Total Installments Paid: ₹{total_installments_paid}")
            print(f"   - Total Earnings: ₹{total_earnings}")
            
            # Expected calculations:
            # Initial installment: ₹100
            # Split payment: ₹200 wallet + ₹100 contribution = ₹300 total
            # Contribution payment: ₹150 to contribution
            # Wallet payment: ₹250 to wallet
            # Total expected earnings: ₹100 + ₹300 + ₹150 + ₹250 = ₹800
            
            expected_total_earnings = 100 + 300 + 150 + 250  # ₹800
            
            print(f"   Expected Total Earnings: ₹{expected_total_earnings}")
            
            # Verify total earnings includes ALL payments (wallet + contribution)
            earnings_correct = abs(total_earnings - expected_total_earnings) < 0.01
            
            if earnings_correct:
                print("   ✅ Total earnings correctly reflects ALL payments (wallet + contribution combined)")
                print("   ✅ CRITICAL VALIDATION PASSED: Employee sees full amount as earned")
            else:
                print(f"   ❌ Total earnings incorrect - Expected ₹{expected_total_earnings}, got ₹{total_earnings}")
                print("   ❌ CRITICAL VALIDATION FAILED: Employee does not see full amount")
            
            # Additional verification: Check that total_earnings = current_balance + total_installments_paid
            calculated_total = current_balance + total_installments_paid
            balance_calculation_correct = abs(total_earnings - calculated_total) < 0.01
            
            if balance_calculation_correct:
                print(f"   ✅ Total earnings calculation verified: ₹{total_earnings} = ₹{current_balance} (balance) + ₹{total_installments_paid} (contribution)")
            else:
                print(f"   ❌ Total earnings calculation error: ₹{total_earnings} ≠ ₹{current_balance} + ₹{total_installments_paid}")
            
            return earnings_correct and balance_calculation_correct
        
        return False

    def test_assignments_with_member_info(self):
        """Test get assignments API for admin - verify member_name and member_mobile - MEDIUM PRIORITY"""
        print("\n" + "="*50)
        print("TESTING GET ASSIGNMENTS API - MEMBER INFO (MEDIUM PRIORITY)")
        print("="*50)
        
        # Test admin fetching assignments
        success, assignments = self.run_test(
            "Admin Get Assignments with Member Info",
            "GET",
            "assignments",
            200,
            token=self.admin_token
        )
        
        if success and isinstance(assignments, list):
            print(f"   ✅ Admin retrieved {len(assignments)} assignments")
            
            member_info_found = False
            for assignment in assignments:
                assignment_id = assignment.get('id')
                member_name = assignment.get('member_name')
                member_mobile = assignment.get('member_mobile')
                assigned_to = assignment.get('assigned_to')
                
                print(f"   Assignment: {assignment.get('title', 'Unknown')}")
                print(f"   - ID: {assignment_id}")
                print(f"   - Assigned to: {assigned_to}")
                print(f"   - Member name: {member_name}")
                print(f"   - Member mobile: {member_mobile}")
                
                if assigned_to and member_name and member_mobile:
                    if member_name != "Unassigned" and member_mobile != "N/A":
                        member_info_found = True
                        print(f"   ✅ Member info correctly populated for assigned work")
                elif not assigned_to:
                    if member_name == "Unassigned" and member_mobile == "N/A":
                        print(f"   ✅ Unassigned work shows appropriate defaults")
                    else:
                        print(f"   ❌ Unassigned work should show 'Unassigned' and 'N/A'")
            
            if member_info_found:
                print("   ✅ VERIFICATION PASSED: Admin can see which employee each work is assigned to")
                return True
            else:
                print("   ❌ VERIFICATION FAILED: No assigned work with member info found")
                return False
        
        return False

    def run_all_tests(self):
        """Run all split payment focused tests"""
        print("🚀 Starting Life Line's MLM Portal Split Payment API Testing")
        print("="*70)
        
        # Setup test environment first
        if not self.setup_test_environment():
            print("❌ Failed to setup test environment")
            return {}
        
        # Test sequence focusing on split payment functionality
        tests = [
            ("Split Payment API", self.test_split_payment_api),
            ("Full Payment to Contribution", self.test_full_payment_to_contribution),
            ("Full Payment to Wallet", self.test_full_payment_to_wallet),
            ("Dashboard Stats Total Earnings", self.test_dashboard_stats_total_earnings),
            ("Assignments with Member Info", self.test_assignments_with_member_info)
        ]
        
        # Run all tests and track results
        for test_name, test_func in tests:
            try:
                print(f"\n{'='*25} {test_name} {'='*25}")
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
    print("🚀 Starting Life Line's MLM Portal Split Payment API Testing")
    print("="*70)
    
    tester = SplitPaymentAPITester()
    
    # Run all tests
    test_results = tester.run_all_tests()
    
    # Print final results
    print("\n" + "="*70)
    print("📊 FINAL TEST RESULTS - SPLIT PAYMENT FUNCTIONALITY")
    print("="*70)
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