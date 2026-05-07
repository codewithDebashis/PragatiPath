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

user_problem_statement: "Verify the View Sample / item description feature on the Pragati Path coaching centre app. Admin should be able to add items (notes/study materials/courses) with description, sample_url and sample_image_base64. Parents in the Shop should see description + a 'View Sample' button that opens the URL or previews the image before paying. Also ensure no regression in existing shop/payments/auth flow."

backend:
  - task: "Items 'coming_soon' field + payment guard"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added coming_soon: bool = False to ItemIn model. POST/PUT /api/admin/items persist + return it. /api/payments now rejects (HTTP 400) if any line item has coming_soon=true. Seeded Olympiad Booster as coming_soon for demo."
        - working: true
          agent: "testing"
          comment: "Verified end-to-end via /app/backend_test.py against external EXPO_PUBLIC_BACKEND_URL/api. 14/14 assertions passed. (TC1) POST /api/admin/items with coming_soon=true returns 200 and response.coming_soon===true. (TC2) PUT /api/admin/items/{id} toggles coming_soon:false then back to true correctly. (TC3) GET /api/admin/items lists the new item with coming_soon flag. (TC4) GET /api/items (parent JWT) returns the item (since active=true) and includes coming_soon=true in the payload. (TC5) Backward compat: POST without coming_soon defaults to false. (TC6) Parent POST /api/payments with only the coming_soon item returns HTTP 400 with detail \"'...' is coming soon and cannot be purchased yet\". (TC7) Mixed cart (one normal + one coming_soon) also returns 400 and rejects the entire payment. (TC8) Regression: payment with only a normal active item returns 200 with status=pending and amount computed from catalog (499×2=998). Cleanup DELETE for both created test items returned 200. No regressions observed."

  - task: "Items CRUD with description, sample_url, sample_image_base64"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "ItemIn model now includes description, sample_url, sample_image_base64. Admin POST/PUT /api/admin/items persists these. GET /api/items (parent) and GET /api/admin/items return them. Needs verification that fields are saved and returned correctly, plus that existing items without these fields still work."
        - working: true
          agent: "testing"
          comment: "Verified end-to-end via /app/backend_test.py against external EXPO_PUBLIC_BACKEND_URL/api. POST /api/admin/items with description, sample_url, sample_image_base64 returns 200 and the response payload contains all three new fields. GET /api/admin/items and GET /api/items (parent) both return the item with description+sample_url+sample_image_base64 intact. PUT /api/admin/items/{id} updates description and sample_url and the response reflects the new values. Backward compat: POST /api/admin/items without description/sample_url/sample_image_base64 succeeds (Optional fields stored as null). DELETE /api/admin/items/{id} returns 200. All 8 item-related assertions passed."

  - task: "Regression – Auth, Payments, Shop flow"
    implemented: true
    working: true
    file: "/app/backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "After item schema change, verify register/login, /api/items (parent), POST /api/payments with an item referencing the new fields, and admin approval still work end-to-end."
        - working: true
          agent: "testing"
          comment: "Full regression passed. Admin login (admin@pragatipath.com/Admin@123) → 200. POST /api/auth/register with first_child details creates parent + child and returns token. POST /api/auth/login for the new parent works. GET /api/auth/me returns the user. GET /api/children/me returns the auto-created child. GET /api/items returns active items including the new sample-enabled one. POST /api/payments with items=[{item_id, qty:1}], child_id, utr, screenshot_base64 → 200 with computed amount=799 matching catalog price. GET /api/admin/payments?status=pending lists the payment. POST /api/admin/payments/{id}/decide with decision=approve → 200, status flips to approved, parent receives 'Payment Approved' notification (item is material so no enrollment expected — verified). All 13 regression assertions passed. Total: 21/21 pass."

frontend:
  - task: "Admin Items editor (description + sample URL + sample image)"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(admin)/items.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Editor supports description, sample URL and sample image pick. Not testing FE without user permission."

  - task: "Parent Shop View Sample modal + description display"
    implemented: true
    working: "NA"
    file: "/app/frontend/app/(parent)/payment.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Shop shows description and 'View Sample' pill. URL opens via Linking, image opens in preview modal. Not testing FE without user permission."

metadata:
  created_by: "main_agent"
  version: "1.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus:
    - "Items 'coming_soon' field + payment guard"
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: "Added new boolean field 'coming_soon' to Item schema. Tasks to test: (1) POST /api/admin/items with coming_soon=true is saved + GET returns it. (2) PUT /api/admin/items/{id} can toggle coming_soon. (3) GET /api/items (parent) returns coming_soon flag. (4) POST /api/payments referencing a coming_soon item must return 400 with 'coming soon and cannot be purchased yet' detail. (5) Regression: payment with normal items still works. Use admin@pragatipath.com/Admin@123 and any registered parent. The seeded 'Olympiad Booster' item already has coming_soon=true."
    - agent: "testing"
      message: "Backend testing complete via /app/backend_test.py against external EXPO_PUBLIC_BACKEND_URL/api. 21/21 assertions passed. Items CRUD (description, sample_url, sample_image_base64) verified on POST/GET(admin)/GET(parent)/PUT/DELETE plus backward-compat POST without the new optional fields. Regression auth+payments+shop flow passed: admin login, parent register, parent login, /auth/me, /children/me, /items, POST /payments (amount computed correctly from catalog), /admin/payments?status=pending lists the payment, /admin/payments/{id}/decide approve flips status and creates 'Payment Approved' notification visible at /notifications/me. No issues found. Both backend tasks set to working:true, needs_retesting:false."
    - agent: "testing"
      message: "coming_soon feature + payment guard verified end-to-end. 14/14 assertions passed against external EXPO_PUBLIC_BACKEND_URL/api. Admin login OK. POST /api/admin/items with coming_soon=true persists and returns the flag (TC1). PUT /api/admin/items/{id} toggles coming_soon false↔true (TC2). GET /api/admin/items and GET /api/items (parent JWT) both return the flag (TC3, TC4). Backward compat: POST without coming_soon defaults to false (TC5). Payment guard: POST /api/payments with only a coming_soon item → HTTP 400, detail=\"'<name>' is coming soon and cannot be purchased yet\" (TC6). Mixed cart with one normal + one coming_soon item → HTTP 400, entire payment rejected (TC7). Regression: payment with only a normal active item → HTTP 200, status=pending, amount correctly computed from catalog (499×2=998) (TC8). Cleanup DELETE for both created test items returned 200. Task now working:true, needs_retesting:false. No further action needed for this backend feature."