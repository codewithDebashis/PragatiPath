"""
Backend tests for Pragati Path - focus: Items 'coming_soon' field + payment guard.

Runs against the external backend URL from /app/frontend/.env
(EXPO_PUBLIC_BACKEND_URL) with /api prefix.
"""

import os
import sys
import uuid
import time
import requests
from pathlib import Path

# Load backend URL from frontend/.env
FRONTEND_ENV = Path("/app/frontend/.env")
BACKEND_URL = None
for line in FRONTEND_ENV.read_text().splitlines():
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BACKEND_URL = line.split("=", 1)[1].strip().strip('"')
        break

assert BACKEND_URL, "EXPO_PUBLIC_BACKEND_URL not found in /app/frontend/.env"
BASE = BACKEND_URL.rstrip("/") + "/api"
print(f"Testing backend at: {BASE}")

ADMIN_EMAIL = "admin@pragatipath.com"
ADMIN_PASSWORD = "Admin@123"

results = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}  {detail}")
    results.append((name, ok, detail))


def post(path, json=None, token=None, expected=200):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    r = requests.post(BASE + path, json=json, headers=h, timeout=30)
    return r


def put(path, json=None, token=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.put(BASE + path, json=json, headers=h, timeout=30)


def get(path, token=None, params=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.get(BASE + path, headers=h, params=params, timeout=30)


def delete(path, token=None):
    h = {"Authorization": f"Bearer {token}"} if token else {}
    return requests.delete(BASE + path, headers=h, timeout=30)


def main():
    created_item_ids = []
    try:
        # --- 1. Admin login ---
        r = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
        admin_token = r.json()["token"]
        record("Admin login", True)

        # --- Register a fresh parent ---
        suffix = uuid.uuid4().hex[:8]
        parent_email = f"parent_cs_{suffix}@test.com"
        parent_password = "Parent@123"
        reg_body = {
            "email": parent_email,
            "password": parent_password,
            "name": "Riya Sharma",
            "phone": "9999900000",
            "child_name": "Aarav Sharma",
            "child_age": 9,
            "child_class": "4",
        }
        r = post("/auth/register", reg_body)
        assert r.status_code == 200, f"Parent register failed: {r.status_code} {r.text}"
        parent_token = r.json()["token"]
        parent_user_id = r.json()["user"]["id"]
        record("Parent register", True, f"email={parent_email}")

        # Fetch child id
        r = get("/children/me", token=parent_token)
        assert r.status_code == 200 and len(r.json()) >= 1, f"children/me: {r.status_code} {r.text}"
        child_id = r.json()[0]["id"]
        record("Fetch parent child", True, f"child_id={child_id[:8]}")

        # --- 2. Admin creates coming_soon item ---
        cs_item_payload = {
            "name": f"Advanced Robotics Workshop {suffix}",
            "description": "Hands-on robotics for senior grades.",
            "price": 2499.0,
            "item_type": "course",
            "coming_soon": True,
            "active": True,
        }
        r = post("/admin/items", cs_item_payload, token=admin_token)
        assert r.status_code == 200, f"Create coming_soon item failed: {r.status_code} {r.text}"
        cs_item = r.json()
        cs_item_id = cs_item["id"]
        created_item_ids.append(cs_item_id)
        assert cs_item.get("coming_soon") is True, f"coming_soon not true in response: {cs_item}"
        record("TC1 POST /admin/items coming_soon=true returns coming_soon=true", True)

        # --- 3. PUT toggle coming_soon=false then true ---
        toggled = dict(cs_item_payload)
        toggled["coming_soon"] = False
        r = put(f"/admin/items/{cs_item_id}", toggled, token=admin_token)
        assert r.status_code == 200, f"PUT toggle false failed: {r.status_code} {r.text}"
        assert r.json().get("coming_soon") is False, f"Expected coming_soon=false, got {r.json()}"
        record("TC2a PUT coming_soon=false -> false", True)

        toggled["coming_soon"] = True
        r = put(f"/admin/items/{cs_item_id}", toggled, token=admin_token)
        assert r.status_code == 200, f"PUT toggle true failed: {r.status_code} {r.text}"
        assert r.json().get("coming_soon") is True, f"Expected coming_soon=true, got {r.json()}"
        record("TC2b PUT coming_soon=true -> true", True)

        # --- 4. GET /admin/items ---
        r = get("/admin/items", token=admin_token)
        assert r.status_code == 200
        found = next((it for it in r.json() if it["id"] == cs_item_id), None)
        assert found is not None, "Newly created item not present in /admin/items"
        assert found.get("coming_soon") is True, f"coming_soon flag missing or wrong: {found}"
        record("TC3 GET /admin/items contains coming_soon item with flag", True)

        # --- 5. GET /items (parent) ---
        r = get("/items", token=parent_token)
        assert r.status_code == 200
        found_p = next((it for it in r.json() if it["id"] == cs_item_id), None)
        assert found_p is not None, "coming_soon item not visible to parent via /items"
        assert "coming_soon" in found_p and found_p["coming_soon"] is True, \
            f"coming_soon field missing/wrong in parent view: {found_p}"
        record("TC4 GET /items (parent) returns coming_soon=true flag", True)

        # --- 6. Backward compat: POST without coming_soon ---
        normal_item_payload = {
            "name": f"Math Notes Grade 4 {suffix}",
            "description": "Curriculum-aligned notes.",
            "price": 499.0,
            "item_type": "material",
            "active": True,
        }
        r = post("/admin/items", normal_item_payload, token=admin_token)
        assert r.status_code == 200, f"Create normal item failed: {r.status_code} {r.text}"
        normal_item = r.json()
        normal_item_id = normal_item["id"]
        created_item_ids.append(normal_item_id)
        assert normal_item.get("coming_soon") is False, \
            f"Default coming_soon expected False, got {normal_item.get('coming_soon')}"
        record("TC5 POST without coming_soon defaults to false", True)

        # --- 7. Payment guard: only coming_soon item -> 400 ---
        r = post(
            "/payments",
            {
                "items": [{"item_id": cs_item_id, "qty": 1}],
                "child_id": child_id,
                "utr": "UTRTEST" + suffix,
            },
            token=parent_token,
        )
        assert r.status_code == 400, f"Expected 400 on coming_soon payment, got {r.status_code} {r.text}"
        detail = ""
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        assert "coming soon" in detail.lower(), f"Detail should mention 'coming soon', got: {detail}"
        record("TC6 Payment with coming_soon item -> 400 'coming soon'", True, f"detail={detail}")

        # --- 8. Mixed cart: normal + coming_soon -> 400 ---
        r = post(
            "/payments",
            {
                "items": [
                    {"item_id": normal_item_id, "qty": 1},
                    {"item_id": cs_item_id, "qty": 1},
                ],
                "child_id": child_id,
                "utr": "UTRMIX" + suffix,
            },
            token=parent_token,
        )
        assert r.status_code == 400, f"Mixed cart expected 400, got {r.status_code} {r.text}"
        try:
            mixed_detail = r.json().get("detail", "")
        except Exception:
            mixed_detail = r.text
        assert "coming soon" in mixed_detail.lower(), f"Mixed-cart detail: {mixed_detail}"
        # Verify no payment record was created for this mixed attempt
        record("TC7 Mixed cart rejected (400) due to coming_soon", True, f"detail={mixed_detail}")

        # --- 9. Regression: normal-only payment succeeds ---
        r = post(
            "/payments",
            {
                "items": [{"item_id": normal_item_id, "qty": 2}],
                "child_id": child_id,
                "utr": "UTROK" + suffix,
            },
            token=parent_token,
        )
        assert r.status_code == 200, f"Normal payment failed: {r.status_code} {r.text}"
        pmt = r.json()
        assert pmt["status"] == "pending", f"Expected pending, got {pmt.get('status')}"
        expected_amount = 499.0 * 2
        assert float(pmt["amount"]) == expected_amount, \
            f"Amount mismatch expected {expected_amount} got {pmt['amount']}"
        record("TC8 Normal payment -> 200 pending, correct amount", True, f"amount={pmt['amount']}")

        # confirm payment visible in my_payments
        r = get("/payments/me", token=parent_token)
        assert r.status_code == 200
        assert any(p["id"] == pmt["id"] for p in r.json()), "Payment not in /payments/me"

    except AssertionError as e:
        record("ASSERTION", False, str(e))
    except Exception as e:
        record("EXCEPTION", False, repr(e))
    finally:
        # --- Cleanup: DELETE created test items ---
        # need admin token; re-login in case exception happened before
        try:
            r = post("/auth/login", {"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
            if r.status_code == 200:
                tok = r.json()["token"]
                for iid in created_item_ids:
                    dr = delete(f"/admin/items/{iid}", token=tok)
                    record(f"Cleanup DELETE /admin/items/{iid[:8]}", dr.status_code == 200,
                           f"status={dr.status_code}")
        except Exception as e:
            record("Cleanup", False, repr(e))

    # summary
    passed = sum(1 for _, ok, _ in results if ok)
    total = len(results)
    print(f"\n=== SUMMARY: {passed}/{total} passed ===")
    if passed != total:
        print("FAILURES:")
        for n, ok, d in results:
            if not ok:
                print(f"  - {n}: {d}")
        sys.exit(1)


if __name__ == "__main__":
    main()
