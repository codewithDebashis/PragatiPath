#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Complete the Life Line's MLM Portal with following features:
  1. Withdrawal prerequisites - Display messages to members about needing 5 joinees
  2. Installment payment tracking - Admin can enter/track 10 installments for registration fees
  3. Daily work report - Members submit reports with class, subject, details columns
  4. Daily work report export - Admin can download reports as Excel file
  5. Multi-file type support - Support image, pdf, video, ppt, excel, collage file types

backend:
  - task: "Withdrawal prerequisites API with 5 joinees check"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend endpoint already implemented at line 603-641. Checks direct_referrals count and returns appropriate error messages."

  - task: "Installment payment tracking API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend endpoint already implemented at line 1083-1135. Admin can record installments, updates user's can_work status after first installment."

  - task: "Daily work report submit API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend endpoint already implemented at line 1137-1181. Members can submit reports with date, class_name, subject, details fields."

  - task: "Daily work report list API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend endpoint already implemented at line 1183-1208. Admin sees all reports, members see only their own."

  - task: "Daily work report Excel export API"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend endpoint already implemented at line 1210-1256. Uses pandas to create Excel file with all report data."

  - task: "Multi-file type support in assignments"
    implemented: true
    working: "NA"
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Backend already supports multiple file types (lines 454-459, 529-534). Allows: .jpg, .jpeg, .png, .gif, .pdf, .doc, .docx, .ppt, .pptx, .xls, .xlsx, .mp4, .avi, .mov, .wmv"

frontend:
  - task: "DailyWorkReportDialog component"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "Component is referenced at line 555 but not defined. Need to create form component with date picker, class, subject, and details fields."
      - working: "NA"
        agent: "main"
        comment: "Implemented DailyWorkReportDialog component with date picker, class, subject, and details fields. Uses Calendar component for date selection and submits to /daily-work-report API endpoint."

  - task: "DailyWorkReports component"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "Component is referenced at line 557 but not defined. Need to create component to display list of daily work reports."
      - working: "NA"
        agent: "main"
        comment: "Implemented DailyWorkReports component that fetches and displays all daily work reports. Shows date, class, subject, details, and user info for each report."

  - task: "Admin installment payment tracking UI"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "No UI exists for admin to record installment payments. Need to add dialog/form in AdminMemberCard component."
      - working: "NA"
        agent: "main"
        comment: "Added installment payment tracking UI in AdminMemberCard. Admin can now record installments with number (1-10) and amount. Shows total installments paid, remaining amount, and list of all installments recorded."

  - task: "Admin daily work reports Excel download"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: false
        agent: "main"
        comment: "Need to add download button in admin dashboard to export daily work reports as Excel."
      - working: "NA"
        agent: "main"
        comment: "Added 'Daily Reports' tab in admin dashboard with download Excel button. Button calls /admin/daily-work-reports/export endpoint and downloads the Excel file."

  - task: "Withdrawal request button tooltip/message"
    implemented: true
    working: "NA"
    file: "/app/frontend/src/App.js"
    stuck_count: 0
    priority: "medium"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Already implemented at line 495. Shows tooltip with message about needing joinees when button is disabled."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 0
  run_ui: false

test_plan:
  current_focus:
    - "Daily work report backend APIs"
    - "Installment payment API"
    - "Withdrawal prerequisites API"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: "Initial test file created. Backend APIs are already implemented. Now implementing missing frontend components: DailyWorkReportDialog, DailyWorkReports, Admin installment tracking UI, and Excel download button. Will test backend first, then frontend."
  - agent: "main"
    message: "Implementation complete! Added all missing frontend components: 1) DailyWorkReportDialog for member daily work submission, 2) DailyWorkReports to display reports, 3) Admin installment tracking UI with dialog in AdminMemberCard, 4) Daily Reports tab in admin dashboard with Excel download button. All components integrated and ready for testing. Backend already has all required endpoints. Starting backend testing now."