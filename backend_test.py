"""Backend tests for Pragati Path Feedback API.

Focus task: "Feedback API – ratings + suggestions + admin view"
"""
import os
import sys
import uuid
import json
import requests

# Resolve backend base URL from the frontend env file (per instructions)
FRONTEND_ENV = "/app/frontend/.env"
BASE = None
with open(FRONTEND_ENV, "r") as f:
    for ln in f:
        ln = ln.strip()
        if ln.startswith("EXPO_PUBLIC_BACKEND_URL="):
            BASE = ln.split("=", 1)[1].strip().strip('"').strip("'")
            break
if not BASE:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL not found in", FRONTEND_ENV)
    sys.exit(2)

API = BASE.rstrip("/") + "/api"
print(f"Testing against: {API}")

ADMIN_EMAIL = "admin@pragatipath.com"
ADMIN_PASSWORD = "Admin@123"

results = []  # list of (ok, name, detail)


def record(ok: bool, name: str, detail: str = ""):
    results.append((ok, name, detail))
    marker = "PASS" if ok else "FAIL"
    print(f"[{marker}] {name} {('- ' + detail) if detail else ''}")


def auth_headers(tok: str):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def post(path, payload, token=None):
    hdr = auth_headers(token) if token else {"Content-Type": "application/json"}
    return requests.post(API + path, headers=hdr, data=json.dumps(payload), timeout=30)


def get(path, token=None):
    hdr = auth_headers(token) if token else {}
    return requests.get(API + path, headers=hdr, timeout=30)


# ---- 0. Admin login ----
r = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
if r.status_code != 200:
    print("Admin login failed:", r.status_code, r.text)
    sys.exit(2)
admin_token = r.json()["token"]
print("Admin login OK.")

# ---- Register a fresh parent for isolated testing ----
unique = uuid.uuid4().hex[:8]
parent_email = f"feedback.parent.{unique}@test.com"
parent_password = "FeedbackTest@123"
reg_body = {
    "email": parent_email,
    "password": parent_password,
    "name": f"Feedback Parent {unique}",
    "phone": "9876500000",
    "child_name": f"Child {unique}",
    "child_age": 9,
    "child_class": "4",
}
r = post("/auth/register", reg_body)
if r.status_code != 200:
    print("Parent register failed:", r.status_code, r.text)
    sys.exit(2)
parent_token = r.json()["token"]
parent_user = r.json()["user"]
print(f"Registered fresh parent: {parent_email}")


# ---- 1. Auth: GET /api/feedback/me without token → 401 ----
r = get("/feedback/me")
record(r.status_code == 401, "1. GET /feedback/me without token returns 401",
       f"got {r.status_code}: {r.text[:120]}")


# ---- 2. Parent submits rating ----
r = post("/feedback", {"type": "rating", "rating": 4, "message": "Nice"}, token=parent_token)
ok2 = r.status_code == 200 and r.json().get("ok") is True
record(ok2, "2. POST /feedback rating=4 returns 200 ok:true",
       f"status={r.status_code} body={r.text[:200]}")


# ---- 3. GET /feedback/me/rated → rated:true, rating:4 ----
r = get("/feedback/me/rated", token=parent_token)
body3 = r.json() if r.status_code == 200 else {}
ok3 = r.status_code == 200 and body3.get("rated") is True and body3.get("rating") == 4
record(ok3, "3. GET /feedback/me/rated returns rated=true rating=4",
       f"status={r.status_code} body={body3}")


# ---- 4. Idempotent: re-submit rating=5 ----
r = post("/feedback", {"type": "rating", "rating": 5, "message": "Even better"}, token=parent_token)
ok4a = r.status_code == 200
record(ok4a, "4a. POST /feedback rating=5 replaces existing rating (200)",
       f"status={r.status_code}")

r = get("/feedback/me/rated", token=parent_token)
body4 = r.json() if r.status_code == 200 else {}
ok4b = body4.get("rated") is True and body4.get("rating") == 5
record(ok4b, "4b. GET /feedback/me/rated returns rated=true rating=5 after update",
       f"body={body4}")

# admin view filtered by rating should show ONE rating row from this user with rating=5
r = get("/admin/feedback?type=rating", token=admin_token)
admin_rating_body = r.json() if r.status_code == 200 else {}
items_for_user = [it for it in admin_rating_body.get("items", []) if it.get("user_id") == parent_user["id"]]
ok4c = (
    r.status_code == 200
    and len(items_for_user) == 1
    and items_for_user[0].get("rating") == 5
    and items_for_user[0].get("type") == "rating"
)
record(ok4c, "4c. Admin /admin/feedback?type=rating shows ONE rating row from this user with rating=5",
       f"count={len(items_for_user)} rows_for_user={items_for_user}")


# ---- 5. Validation: POST /feedback {type:rating} (no rating) → 400 ----
r = post("/feedback", {"type": "rating"}, token=parent_token)
record(r.status_code == 400, "5. POST /feedback type=rating without rating returns 400",
       f"status={r.status_code} body={r.text[:200]}")


# ---- 6. Validation: rating=6 → 422 or 400 ----
r = post("/feedback", {"type": "rating", "rating": 6}, token=parent_token)
record(r.status_code in (400, 422), "6. POST /feedback rating=6 returns 400 or 422",
       f"status={r.status_code} body={r.text[:200]}")


# ---- 7. Suggestion: POST suggestion → 200, listed in /feedback/me ----
r = post("/feedback", {"type": "suggestion", "message": "Please add Hindi medium"}, token=parent_token)
ok7a = r.status_code == 200 and r.json().get("ok") is True
record(ok7a, "7a. POST /feedback suggestion returns 200 ok:true",
       f"status={r.status_code} body={r.text[:200]}")

r = get("/feedback/me", token=parent_token)
me_items = r.json() if r.status_code == 200 else []
has_suggestion = any(
    it.get("type") == "suggestion" and it.get("message") == "Please add Hindi medium"
    for it in me_items
)
ok7b = r.status_code == 200 and has_suggestion
record(ok7b, "7b. GET /feedback/me lists the suggestion for this parent",
       f"status={r.status_code} count={len(me_items) if isinstance(me_items, list) else 'N/A'}")


# ---- 8. Suggestion validation: missing message → 400 ----
r = post("/feedback", {"type": "suggestion"}, token=parent_token)
record(r.status_code == 400, "8. POST /feedback suggestion without message returns 400",
       f"status={r.status_code} body={r.text[:200]}")

# bonus: empty whitespace message should also be 400
r = post("/feedback", {"type": "suggestion", "message": "   "}, token=parent_token)
record(r.status_code == 400, "8b. POST /feedback suggestion with whitespace-only message returns 400",
       f"status={r.status_code} body={r.text[:200]}")


# ---- 9. Admin blocked from POST /feedback ----
r = post("/feedback", {"type": "suggestion", "message": "x"}, token=admin_token)
record(r.status_code == 400, "9. Admin POST /feedback returns 400",
       f"status={r.status_code} body={r.text[:200]}")


# ---- 10. Parent blocked from /admin/feedback → 403 ----
r = get("/admin/feedback", token=parent_token)
record(r.status_code == 403, "10. Parent GET /admin/feedback returns 403",
       f"status={r.status_code} body={r.text[:200]}")


# ---- 11. Admin GET /admin/feedback (no filter) ----
r = get("/admin/feedback", token=admin_token)
body11 = r.json() if r.status_code == 200 else {}
items11 = body11.get("items", [])
ratings_all = [it["rating"] for it in items11 if it.get("type") == "rating" and it.get("rating") is not None]
expected_avg = round(sum(ratings_all) / len(ratings_all), 2) if ratings_all else None
expected_count = len(ratings_all)

ok11 = (
    r.status_code == 200
    and "items" in body11
    and "avg_rating" in body11
    and "rating_count" in body11
    and body11.get("rating_count") == expected_count
    and (
        (expected_avg is None and body11.get("avg_rating") is None)
        or (
            expected_avg is not None and body11.get("avg_rating") is not None
            and abs(float(body11["avg_rating"]) - expected_avg) < 0.01
        )
    )
)
record(ok11, "11. Admin GET /admin/feedback returns items/avg_rating/rating_count with correct aggregation",
       f"api_avg={body11.get('avg_rating')} expected_avg={expected_avg} "
       f"api_count={body11.get('rating_count')} expected_count={expected_count}")


# ---- 12. Admin GET /admin/feedback?type=suggestion ----
r = get("/admin/feedback?type=suggestion", token=admin_token)
body12 = r.json() if r.status_code == 200 else {}
only_suggestions = all(it.get("type") == "suggestion" for it in body12.get("items", []))
ok12 = (
    r.status_code == 200
    and isinstance(body12.get("items"), list)
    and only_suggestions
    and body12.get("avg_rating") is None
    and body12.get("rating_count") == 0
)
record(ok12, "12. Admin GET /admin/feedback?type=suggestion returns only suggestions, avg_rating None",
       f"items_count={len(body12.get('items', []))} only_suggestions={only_suggestions} "
       f"avg={body12.get('avg_rating')} rating_count={body12.get('rating_count')}")

has_our_suggestion = any(
    it.get("user_id") == parent_user["id"] and it.get("message") == "Please add Hindi medium"
    for it in body12.get("items", [])
)
record(has_our_suggestion, "12b. Suggestion from our test parent appears in admin suggestion list")


# ---- 13. Admin GET /admin/feedback?type=rating ----
r = get("/admin/feedback?type=rating", token=admin_token)
body13 = r.json() if r.status_code == 200 else {}
only_ratings = all(it.get("type") == "rating" for it in body13.get("items", []))
ok13 = r.status_code == 200 and only_ratings
record(ok13, "13. Admin GET /admin/feedback?type=rating returns only rating items",
       f"count={len(body13.get('items', []))} only_ratings={only_ratings} "
       f"avg={body13.get('avg_rating')} rating_count={body13.get('rating_count')}")


# ---- Summary ----
passed = sum(1 for ok, *_ in results if ok)
total = len(results)
print(f"\n==== RESULT: {passed}/{total} passed ====")
for ok, name, detail in results:
    if not ok:
        print(f"  FAIL: {name} -- {detail}")
sys.exit(0 if passed == total else 1)
