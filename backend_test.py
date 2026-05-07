"""
Backend tests for: Admin reply to feedback + Push token endpoints.
Runs against external EXPO_PUBLIC_BACKEND_URL/api.
"""
import os
import sys
import uuid
import json
import time
from pathlib import Path

import requests

# Load EXPO_PUBLIC_BACKEND_URL from /app/frontend/.env
FRONTEND_ENV = Path("/app/frontend/.env")
BASE_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not found in frontend/.env"
API = BASE_URL.rstrip("/") + "/api"
print(f"BASE API: {API}")

ADMIN_EMAIL = "admin@pragatipath.com"
ADMIN_PASSWORD = "Admin@123"

results = []  # (name, ok, info)


def record(name, ok, info=""):
    results.append((name, ok, info))
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name} :: {info}")


def login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    j = r.json()
    return j["token"], j["user"]


def register_parent():
    suffix = uuid.uuid4().hex[:8]
    email = f"feedback.reply.{suffix}@test.com"
    password = "Parent@12345"
    payload = {
        "email": email,
        "password": password,
        "name": f"Reply Test Parent {suffix}",
        "phone": "9876543210",
        "child_name": f"Aarav {suffix}",
        "child_age": 9,
        "child_class": "4",
    }
    r = requests.post(f"{API}/auth/register", json=payload, timeout=20)
    r.raise_for_status()
    j = r.json()
    return j["token"], j["user"], email, password


def H(token):
    return {"Authorization": f"Bearer {token}"}


def main():
    # --- Admin login ---
    try:
        admin_token, admin_user = login(ADMIN_EMAIL, ADMIN_PASSWORD)
        record("Admin login", True, f"id={admin_user.get('id')}")
    except Exception as e:
        record("Admin login", False, str(e))
        return summarize()

    # --- Parent: prefer demo, else register fresh ---
    parent_token = None
    parent_user = None
    try:
        parent_token, parent_user = login("demo.parent@test.com", "demo12345")
        record("Demo parent login", True, f"id={parent_user.get('id')}")
    except Exception as e:
        record("Demo parent login", False, f"will register fresh: {e}")
        try:
            parent_token, parent_user, p_email, p_pw = register_parent()
            record("Fresh parent register", True, f"email={p_email}")
        except Exception as e2:
            record("Fresh parent register", False, str(e2))
            return summarize()

    # ============================================================
    # A) Admin reply to feedback
    # ============================================================

    # 1. Parent creates suggestion
    feedback_id = None
    try:
        r = requests.post(
            f"{API}/feedback",
            json={"type": "suggestion", "message": "Need night classes"},
            headers=H(parent_token),
            timeout=20,
        )
        ok = r.status_code == 200
        j = r.json() if ok else {}
        feedback_id = j.get("id")
        record("A1 Parent POST /feedback suggestion", ok and bool(feedback_id), f"status={r.status_code} id={feedback_id}")
    except Exception as e:
        record("A1 Parent POST /feedback suggestion", False, str(e))

    if not feedback_id:
        return summarize()

    # 2. Admin POST reply
    reply_text = "We will add night classes from next month."
    try:
        r = requests.post(
            f"{API}/admin/feedback/{feedback_id}/reply",
            json={"admin_reply": reply_text},
            headers=H(admin_token),
            timeout=20,
        )
        ok = r.status_code == 200
        j = r.json() if ok else {}
        ok &= j.get("admin_reply") == reply_text
        ok &= bool(j.get("admin_reply_at"))
        ok &= j.get("message") == "Need night classes"
        record(
            "A2 Admin POST /admin/feedback/{id}/reply",
            ok,
            f"status={r.status_code} reply={j.get('admin_reply')!r} at={j.get('admin_reply_at')!r} msg={j.get('message')!r}",
        )
    except Exception as e:
        record("A2 Admin POST /admin/feedback/{id}/reply", False, str(e))

    # 3. Admin GET /api/admin/feedback → entry has admin_reply
    try:
        r = requests.get(f"{API}/admin/feedback", headers=H(admin_token), timeout=20)
        ok = r.status_code == 200
        j = r.json() if ok else {}
        items = j.get("items", []) if ok else []
        target = next((it for it in items if it.get("id") == feedback_id), None)
        ok2 = bool(target) and target.get("admin_reply") == reply_text and bool(target.get("admin_reply_at"))
        record("A3 Admin GET /admin/feedback contains reply", ok and ok2,
               f"status={r.status_code} found={bool(target)} reply_set={(target or {}).get('admin_reply')!r}")
    except Exception as e:
        record("A3 Admin GET /admin/feedback contains reply", False, str(e))

    # 4. Parent GET /api/feedback/me → has admin_reply
    try:
        r = requests.get(f"{API}/feedback/me", headers=H(parent_token), timeout=20)
        ok = r.status_code == 200
        items = r.json() if ok else []
        target = next((it for it in items if it.get("id") == feedback_id), None)
        ok2 = bool(target) and target.get("admin_reply") == reply_text and bool(target.get("admin_reply_at"))
        record("A4 Parent GET /feedback/me sees admin_reply", ok and ok2,
               f"status={r.status_code} reply={(target or {}).get('admin_reply')!r} at={(target or {}).get('admin_reply_at')!r}")
    except Exception as e:
        record("A4 Parent GET /feedback/me sees admin_reply", False, str(e))

    # 5. Parent GET /api/notifications/me → contains feedback_reply notification
    try:
        r = requests.get(f"{API}/notifications/me", headers=H(parent_token), timeout=20)
        ok = r.status_code == 200
        notifs = r.json() if ok else []
        target = next(
            (n for n in notifs if n.get("title") == "Reply to your feedback" and reply_text[:50] in (n.get("body") or "")),
            None,
        )
        record("A5 Parent GET /notifications/me has Reply notification", ok and bool(target),
               f"status={r.status_code} found_title={bool(target)} count={len(notifs)}")
    except Exception as e:
        record("A5 Parent GET /notifications/me has Reply notification", False, str(e))

    # 6. Admin replies again with new text → admin_reply updated
    new_reply = "Update: night classes will start from next Monday at 7pm."
    try:
        r = requests.post(
            f"{API}/admin/feedback/{feedback_id}/reply",
            json={"admin_reply": new_reply},
            headers=H(admin_token),
            timeout=20,
        )
        ok = r.status_code == 200
        j = r.json() if ok else {}
        ok &= j.get("admin_reply") == new_reply
        record("A6 Admin re-reply updates admin_reply", ok,
               f"status={r.status_code} reply={j.get('admin_reply')!r}")
    except Exception as e:
        record("A6 Admin re-reply updates admin_reply", False, str(e))

    # 7. Validation: empty admin_reply → 422
    try:
        r = requests.post(
            f"{API}/admin/feedback/{feedback_id}/reply",
            json={"admin_reply": ""},
            headers=H(admin_token),
            timeout=20,
        )
        record("A7 Empty admin_reply → 422", r.status_code == 422, f"status={r.status_code} body={r.text[:120]}")
    except Exception as e:
        record("A7 Empty admin_reply → 422", False, str(e))

    # 8. Non-existent id → 404
    try:
        fake = str(uuid.uuid4())
        r = requests.post(
            f"{API}/admin/feedback/{fake}/reply",
            json={"admin_reply": "Hi"},
            headers=H(admin_token),
            timeout=20,
        )
        record("A8 Non-existent id → 404", r.status_code == 404, f"status={r.status_code}")
    except Exception as e:
        record("A8 Non-existent id → 404", False, str(e))

    # 9. Parent posting reply route → 403
    try:
        r = requests.post(
            f"{API}/admin/feedback/{feedback_id}/reply",
            json={"admin_reply": "I am parent"},
            headers=H(parent_token),
            timeout=20,
        )
        record("A9 Parent on admin reply → 403", r.status_code == 403, f"status={r.status_code} body={r.text[:120]}")
    except Exception as e:
        record("A9 Parent on admin reply → 403", False, str(e))

    # ============================================================
    # B) Push token endpoints
    # ============================================================

    # 10. Auth required → 401
    try:
        r = requests.post(
            f"{API}/users/me/push-token",
            json={"push_token": "ExponentPushToken[abc123fakeforTest]", "platform": "android"},
            timeout=20,
        )
        record("B10 Push token POST without auth → 401", r.status_code == 401, f"status={r.status_code}")
    except Exception as e:
        record("B10 Push token POST without auth → 401", False, str(e))

    # 11. Parent POST /users/me/push-token → 200 ok=true
    try:
        r = requests.post(
            f"{API}/users/me/push-token",
            json={"push_token": "ExponentPushToken[abc123fakeforTest]", "platform": "android"},
            headers=H(parent_token),
            timeout=20,
        )
        ok = r.status_code == 200 and (r.json().get("ok") is True)
        record("B11 Parent POST push-token → 200 ok=true", ok, f"status={r.status_code} body={r.text[:150]}")
    except Exception as e:
        record("B11 Parent POST push-token → 200 ok=true", False, str(e))

    # 12. Idempotent re-POST with new token → 200
    try:
        r = requests.post(
            f"{API}/users/me/push-token",
            json={"push_token": "ExponentPushToken[abc123fakeforTest2]", "platform": "android"},
            headers=H(parent_token),
            timeout=20,
        )
        ok = r.status_code == 200 and (r.json().get("ok") is True)
        record("B12 Re-POST push-token (overwrite) → 200", ok, f"status={r.status_code} body={r.text[:150]}")
    except Exception as e:
        record("B12 Re-POST push-token (overwrite) → 200", False, str(e))

    # 13. DELETE /users/me/push-token → 200
    try:
        r = requests.delete(f"{API}/users/me/push-token", headers=H(parent_token), timeout=20)
        ok = r.status_code == 200 and (r.json().get("ok") is True)
        record("B13 DELETE push-token → 200 ok=true", ok, f"status={r.status_code} body={r.text[:150]}")
    except Exception as e:
        record("B13 DELETE push-token → 200 ok=true", False, str(e))

    # 14. Validation: empty push_token → 422
    try:
        r = requests.post(
            f"{API}/users/me/push-token",
            json={"push_token": "", "platform": "android"},
            headers=H(parent_token),
            timeout=20,
        )
        # spec: 422 (pydantic min_length=4)
        record("B14 Empty push_token → 422", r.status_code == 422, f"status={r.status_code} body={r.text[:150]}")
    except Exception as e:
        record("B14 Empty push_token → 422", False, str(e))

    # Bonus: Sanity – endpoints don't crash even after deleting
    try:
        r = requests.delete(f"{API}/users/me/push-token", headers=H(parent_token), timeout=20)
        record("B-extra DELETE push-token (no token saved) → 200", r.status_code == 200, f"status={r.status_code}")
    except Exception as e:
        record("B-extra DELETE push-token (no token saved) → 200", False, str(e))

    return summarize()


def summarize():
    print("\n" + "=" * 60)
    passed = sum(1 for _, ok, _ in results if ok)
    failed = [n for n, ok, _ in results if not ok]
    print(f"Passed: {passed}/{len(results)}")
    if failed:
        print("Failed:")
        for n in failed:
            print(f" - {n}")
    print("=" * 60)
    return 0 if not failed else 1


if __name__ == "__main__":
    sys.exit(main())
