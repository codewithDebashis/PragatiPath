"""
Pragati Path - Backend API Tests
Covers: auth, UPI settings, payments, admin decisions, notifications, ads, users, template, stats.
Uses public preview URL.
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"

ADMIN_EMAIL = "admin@pragatipath.com"
ADMIN_PASSWORD = "Admin@123"

# Unique test parent per run
RUN_TAG = uuid.uuid4().hex[:6]
PARENT_EMAIL = f"test_parent_{RUN_TAG}@test.com"
PARENT_PASSWORD = "parent123"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def parent_data(session):
    payload = {
        "email": PARENT_EMAIL,
        "password": PARENT_PASSWORD,
        "name": "TEST Parent",
        "phone": "9999999999",
        "child_name": "TEST Child",
        "child_age": 10,
        "child_class": "5",
    }
    r = session.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "parent"
    assert data["user"]["enrollment_status"] == "pending"
    assert "_id" not in data["user"]
    assert "password_hash" not in data["user"]
    return {"token": data["token"], "user": data["user"], "password": PARENT_PASSWORD}


# ---------------- Auth ----------------
class TestAuth:
    def test_register_returns_token_and_role_parent(self, parent_data):
        assert parent_data["token"]
        assert parent_data["user"]["role"] == "parent"
        assert parent_data["user"]["user_id_code"]

    def test_admin_login(self, admin_token):
        assert admin_token

    def test_me_returns_current_user(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {parent_data['token']}"})
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == PARENT_EMAIL
        assert u["role"] == "parent"
        assert "_id" not in u
        assert "password_hash" not in u

    def test_me_unauthenticated(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_login_invalid_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401


# ---------------- UPI Settings ----------------
class TestUpiSettings:
    def test_get_default_upi_seeded(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/upi-settings", headers={"Authorization": f"Bearer {parent_data['token']}"})
        assert r.status_code == 200
        s = r.json()
        assert s.get("upi_id") == "pragatipath@upi"
        assert float(s.get("fee_amount", 0)) == 5000.0
        assert "_id" not in s

    def test_parent_cannot_update_upi(self, session, parent_data):
        r = session.put(
            f"{BASE_URL}/api/admin/upi-settings",
            json={"upi_id": "hacker@upi"},
            headers={"Authorization": f"Bearer {parent_data['token']}"},
        )
        assert r.status_code == 403

    def test_admin_update_upi_then_revert(self, session, admin_token):
        new_upi = "pragatipath@upi"
        r = session.put(
            f"{BASE_URL}/api/admin/upi-settings",
            json={"upi_id": new_upi, "fee_amount": 5000, "instructions": "Pay using any UPI app, then upload the screenshot or enter the UTR/Transaction ID."},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        s = r.json()
        assert s["upi_id"] == new_upi
        assert "_id" not in s


# ---------------- Payments ----------------
class TestPayments:
    def test_admin_cannot_create_payment(self, session, admin_token):
        r = session.post(
            f"{BASE_URL}/api/payments",
            json={"amount": 5000, "utr": "TESTUTR1"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 400

    def test_parent_creates_payment(self, session, parent_data):
        r = session.post(
            f"{BASE_URL}/api/payments",
            json={"amount": 5000, "utr": f"UTR-{RUN_TAG}", "note": "TEST payment"},
            headers={"Authorization": f"Bearer {parent_data['token']}"},
        )
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "pending"
        assert p["user_id"] == parent_data["user"]["id"]
        assert "_id" not in p
        parent_data["payment_id"] = p["id"]

    def test_get_my_payments(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/payments/me", headers={"Authorization": f"Bearer {parent_data['token']}"})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any(p["id"] == parent_data["payment_id"] for p in items)
        for p in items:
            assert "_id" not in p

    def test_admin_lists_pending(self, session, admin_token, parent_data):
        r = session.get(
            f"{BASE_URL}/api/admin/payments?status=pending",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        items = r.json()
        assert any(p["id"] == parent_data["payment_id"] for p in items)
        for p in items:
            assert p["status"] == "pending"
            assert "_id" not in p

    def test_parent_cannot_list_admin_payments(self, session, parent_data):
        r = session.get(
            f"{BASE_URL}/api/admin/payments",
            headers={"Authorization": f"Bearer {parent_data['token']}"},
        )
        assert r.status_code == 403

    def test_admin_approves_and_user_enrolled(self, session, admin_token, parent_data):
        pid = parent_data["payment_id"]
        r = session.post(
            f"{BASE_URL}/api/admin/payments/{pid}/decide",
            json={"decision": "approve", "admin_note": "verified"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200, r.text
        decided = r.json()
        assert decided["status"] == "approved"
        assert "_id" not in decided

        # user enrolled
        r2 = session.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {parent_data['token']}"})
        assert r2.status_code == 200
        assert r2.json()["enrollment_status"] == "enrolled"

    def test_notifications_template_with_user_id_and_password(self, session, parent_data):
        # small wait for async writes
        time.sleep(1)
        r = session.get(
            f"{BASE_URL}/api/notifications/me",
            headers={"Authorization": f"Bearer {parent_data['token']}"},
        )
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        enrollment = [n for n in items if n["type"] == "enrollment"]
        assert enrollment, "No enrollment notification found"
        body = enrollment[0]["body"]
        assert parent_data["user"]["user_id_code"] in body
        assert "password is" in body.lower() or "password" in body.lower()
        # The password must be a real generated 8-char token, not the placeholder
        assert "{password}" not in body
        assert "{user_id}" not in body
        # save the password to verify login works
        # extract last word that looks like password (after "password is")
        import re
        m = re.search(r"password is\s+([A-Za-z0-9]+)", body)
        assert m, f"Could not parse password from notification body: {body}"
        new_pw = m.group(1).rstrip(".")
        parent_data["new_password"] = new_pw

    def test_login_with_new_issued_password(self, session, parent_data):
        new_pw = parent_data.get("new_password")
        assert new_pw
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": PARENT_EMAIL, "password": new_pw})
        assert r.status_code == 200, f"Login with newly issued password should work: {r.status_code} {r.text}"

    def test_reject_flow_creates_notification(self, session, parent_data, admin_token):
        # Use a fresh parent for reject flow
        email2 = f"test_reject_{RUN_TAG}@test.com"
        r = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email2, "password": "abc1234", "name": "TEST Reject",
            "child_name": "TEST C2", "child_age": 8, "child_class": "3"
        })
        assert r.status_code == 200
        tok = r.json()["token"]

        rp = session.post(
            f"{BASE_URL}/api/payments",
            json={"amount": 5000, "utr": f"REJ-{RUN_TAG}"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert rp.status_code == 200
        pid = rp.json()["id"]

        rd = session.post(
            f"{BASE_URL}/api/admin/payments/{pid}/decide",
            json={"decision": "reject", "admin_note": "TEST invalid utr"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert rd.status_code == 200
        assert rd.json()["status"] == "rejected"

        time.sleep(1)
        rn = session.get(f"{BASE_URL}/api/notifications/me", headers={"Authorization": f"Bearer {tok}"})
        assert rn.status_code == 200
        items = rn.json()
        assert any(n["type"] == "payment" for n in items)


# ---------------- Ads ----------------
class TestAds:
    ad_id = None

    def test_parent_get_ads(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/ads", headers={"Authorization": f"Bearer {parent_data['token']}"})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for it in items:
            assert it["active"] is True
            assert "_id" not in it

    def test_parent_cannot_create_ad(self, session, parent_data):
        r = session.post(
            f"{BASE_URL}/api/admin/ads",
            json={"title": "TEST hack", "body": "x", "active": True},
            headers={"Authorization": f"Bearer {parent_data['token']}"},
        )
        assert r.status_code == 403

    def test_admin_ad_crud(self, session, admin_token):
        r = session.post(
            f"{BASE_URL}/api/admin/ads",
            json={"title": "TEST Ad", "body": "TEST body", "active": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code == 200
        ad = r.json()
        assert ad["title"] == "TEST Ad"
        assert "_id" not in ad
        TestAds.ad_id = ad["id"]

        # update
        ru = session.put(
            f"{BASE_URL}/api/admin/ads/{TestAds.ad_id}",
            json={"title": "TEST Ad Updated", "body": "TEST body", "active": False},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert ru.status_code == 200
        assert ru.json()["title"] == "TEST Ad Updated"
        assert ru.json()["active"] is False

        # delete
        rd = session.delete(
            f"{BASE_URL}/api/admin/ads/{TestAds.ad_id}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert rd.status_code == 200


# ---------------- Admin: Users / Template / Stats ----------------
class TestAdmin:
    def test_users_list_excludes_admin_and_password(self, session, admin_token):
        r = session.get(f"{BASE_URL}/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        for u in items:
            assert u["role"] != "admin"
            assert "password_hash" not in u
            assert "_id" not in u

    def test_template_get_and_update(self, session, admin_token):
        r = session.get(f"{BASE_URL}/api/admin/template", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        original = r.json()["template"]
        assert original

        new_tpl = "Congratulations! Your User ID is {user_id} and password is {password}. Pragati Path is designed for Winners."
        r2 = session.put(
            f"{BASE_URL}/api/admin/template",
            json={"template": new_tpl},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r2.status_code == 200
        assert r2.json()["template"] == new_tpl

        # restore original
        session.put(
            f"{BASE_URL}/api/admin/template",
            json={"template": original},
            headers={"Authorization": f"Bearer {admin_token}"},
        )

    def test_admin_stats(self, session, admin_token):
        r = session.get(f"{BASE_URL}/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
        assert r.status_code == 200
        stats = r.json()
        for k in ["pending_payments", "approved_payments", "total_users", "enrolled_users", "active_ads"]:
            assert k in stats
            assert isinstance(stats[k], int)
