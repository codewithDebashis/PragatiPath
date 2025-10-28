import requests
import json

# Test the specific submission we just created
base_url = "https://mlm-portal-1.preview.emergentagent.com/api"

# Login as admin
login_response = requests.post(f"{base_url}/auth/login", json={
    "mobile_number": "9999999999",
    "password": "admin123"
})

if login_response.status_code == 200:
    admin_token = login_response.json()['access_token']
    
    # Get all submissions
    headers = {'Authorization': f'Bearer {admin_token}'}
    submissions_response = requests.get(f"{base_url}/admin/submissions", headers=headers)
    
    if submissions_response.status_code == 200:
        submissions = submissions_response.json()
        
        # Find the most recent submission (our test submission)
        latest_submission = None
        for submission in submissions:
            if submission.get('file_name') == 'lesson_plan_feedback.png':
                latest_submission = submission
                break
        
        if latest_submission:
            print("🔍 VERIFICATION: Latest Test Submission")
            print("="*50)
            print(f"ID: {latest_submission.get('id')}")
            print(f"User: {latest_submission.get('user_name')}")
            print(f"Assignment: {latest_submission.get('assignment_title')}")
            print(f"File Name: {latest_submission.get('file_name')}")
            print(f"Has file_data: {'Yes' if latest_submission.get('file_data') else 'No'}")
            print(f"Status: {latest_submission.get('status')}")
            
            # Critical check
            has_correct_fields = (
                'file_name' in latest_submission and 
                'file_data' in latest_submission and
                latest_submission.get('file_name') and
                latest_submission.get('file_data')
            )
            
            print(f"\n✅ Correct field mapping: {has_correct_fields}")
            
            if has_correct_fields:
                print("🎉 SUCCESS: New submission has correct field names!")
                print("   Frontend download button will work correctly!")
            else:
                print("❌ FAILURE: New submission missing correct fields!")
        else:
            print("❌ Could not find our test submission")
    else:
        print(f"❌ Failed to get submissions: {submissions_response.status_code}")
else:
    print(f"❌ Admin login failed: {login_response.status_code}")