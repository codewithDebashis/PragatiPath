"""
Pragati Path - Backend API Tests (v2: items+cart+children+attendance)
"""
import os
import re
import time
import uuid
import pytest
import requests
from datetime import date, timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL not set"

ADMIN_EMAIL = "admin@pragatipath.com"
ADMIN_PASSWORD = "Admin@123"

RUN_TAG = uuid.uuid4().hex[:6]
PARENT_EMAIL = f"test_parent_{RUN_TAG}@test.com"
PARENT_PASSWORD = "parent123"


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def parent_data(session):
    payload = {
        "email": PARENT_EMAIL, "password": PARENT_PASSWORD,
        "name": "TEST Parent", "phone": "9999999999",
        "child_name": "TEST Child", "child_age": 10, "child_class": "5",
    }
    r = session.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "parent"
    assert "_id" not in data["user"] and "password_hash" not in data["user"]
    return {"token": data["token"], "user": data["user"], "password": PARENT_PASSWORD}


# ---------------- Auth ----------------
class TestAuth:
    def test_register_and_me(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/auth/me", headers=_h(parent_data["token"]))
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == PARENT_EMAIL
        assert u["role"] == "parent"
        assert "_id" not in u and "password_hash" not in u

    def test_login_invalid(self, session):
        r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me_unauth(self, session):
        r = session.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ---------------- Children ----------------
class TestChildren:
    def test_register_autocreates_child(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/children/me", headers=_h(parent_data["token"]))
        assert r.status_code == 200
        kids = r.json()
        assert isinstance(kids, list) and len(kids) >= 1
        k = kids[0]
        assert k["name"] == "TEST Child"
        assert re.match(r"^PPC-[A-F0-9]{6}$", k["child_id_code"])
        assert k["enrollment_status"] == "pending"
        assert "_id" not in k
        parent_data["child_id"] = k["id"]

    def test_add_second_child(self, session, parent_data):
        r = session.post(f"{BASE_URL}/api/children",
                         json={"name": "TEST Sibling", "age": 7, "child_class": "2"},
                         headers=_h(parent_data["token"]))
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == "TEST Sibling"
        assert c["child_id_code"].startswith("PPC-")
        parent_data["sibling_id"] = c["id"]

        r2 = session.get(f"{BASE_URL}/api/children/me", headers=_h(parent_data["token"]))
        assert len(r2.json()) >= 2

    def test_update_child(self, session, parent_data):
        cid = parent_data["sibling_id"]
        r = session.put(f"{BASE_URL}/api/children/{cid}",
                        json={"name": "TEST Sibling Updated", "age": 8, "child_class": "3"},
                        headers=_h(parent_data["token"]))
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Sibling Updated"

    def test_admin_cannot_add_child(self, session, admin_token):
        r = session.post(f"{BASE_URL}/api/children",
                         json={"name": "x", "age": 1, "child_class": "1"},
                         headers=_h(admin_token))
        assert r.status_code == 400

    def test_admin_list_all_children(self, session, admin_token, parent_data):
        r = session.get(f"{BASE_URL}/api/admin/children", headers=_h(admin_token))
        assert r.status_code == 200
        kids = r.json()
        assert any(k["id"] == parent_data["child_id"] for k in kids)
        for k in kids:
            assert "_id" not in k

    def test_parent_cannot_list_all_children(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/admin/children", headers=_h(parent_data["token"]))
        assert r.status_code == 403

    def test_delete_child(self, session, parent_data):
        # Create a throwaway child then delete
        r = session.post(f"{BASE_URL}/api/children",
                         json={"name": "TEST ToDelete", "age": 6, "child_class": "1"},
                         headers=_h(parent_data["token"]))
        cid = r.json()["id"]
        r2 = session.delete(f"{BASE_URL}/api/children/{cid}", headers=_h(parent_data["token"]))
        assert r2.status_code == 200


# ---------------- Items ----------------
class TestItems:
    def test_default_seeded_items(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/items", headers=_h(parent_data["token"]))
        assert r.status_code == 200
        items = r.json()
        names = [i["name"] for i in items]
        for required in [
            "Foundation Course (Class 1-5)",
            "Excellence Course (Class 6-10)",
            "Olympiad Booster",
            "Study Material Pack",
            "Sample Paper Set",
            "Pragati Path T-Shirt",
        ]:
            assert required in names, f"Missing seeded item {required}"
        for it in items:
            assert it["active"] is True
            assert "_id" not in it
            assert it["item_type"] in ("course", "material", "merch", "other")

    def test_parent_forbidden_admin_items(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/admin/items", headers=_h(parent_data["token"]))
        assert r.status_code == 403
        r2 = session.post(f"{BASE_URL}/api/admin/items",
                          json={"name": "hack", "price": 1, "item_type": "other"},
                          headers=_h(parent_data["token"]))
        assert r2.status_code == 403

    def test_admin_item_crud_and_type_validation(self, session, admin_token):
        # invalid item_type -> 422
        r_bad = session.post(f"{BASE_URL}/api/admin/items",
                             json={"name": "TEST Bad", "price": 1, "item_type": "weapon"},
                             headers=_h(admin_token))
        assert r_bad.status_code == 422

        r = session.post(f"{BASE_URL}/api/admin/items",
                         json={"name": "TEST Item", "description": "t", "price": 99.5,
                               "item_type": "material", "active": True},
                         headers=_h(admin_token))
        assert r.status_code == 200
        iid = r.json()["id"]

        ru = session.put(f"{BASE_URL}/api/admin/items/{iid}",
                         json={"name": "TEST Item 2", "price": 100, "item_type": "material", "active": False},
                         headers=_h(admin_token))
        assert ru.status_code == 200
        assert ru.json()["active"] is False

        rd = session.delete(f"{BASE_URL}/api/admin/items/{iid}", headers=_h(admin_token))
        assert rd.status_code == 200


# ---------------- Payments (cart + course enrollment) ----------------
class TestPayments:
    def _course_item_id(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/items", headers=_h(parent_data["token"]))
        for it in r.json():
            if it["item_type"] == "course":
                return it["id"], it["price"]
        pytest.fail("No course item seeded")

    def _material_item_id(self, session, parent_data):
        r = session.get(f"{BASE_URL}/api/items", headers=_h(parent_data["token"]))
        for it in r.json():
            if it["item_type"] == "material":
                return it["id"], it["price"]
        pytest.fail("No material item seeded")

    def test_empty_items_rejected(self, session, parent_data):
        r = session.post(f"{BASE_URL}/api/payments", json={"items": []},
                         headers=_h(parent_data["token"]))
        assert r.status_code == 400

    def test_admin_cannot_pay(self, session, admin_token, parent_data):
        iid, _ = self._course_item_id(session, parent_data)
        r = session.post(f"{BASE_URL}/api/payments",
                         json={"items": [{"item_id": iid, "qty": 1}]},
                         headers=_h(admin_token))
        assert r.status_code == 400

    def test_course_payment_with_child_approve_enrolls(self, session, parent_data, admin_token):
        iid, price = self._course_item_id(session, parent_data)
        mid, mprice = self._material_item_id(session, parent_data)
        r = session.post(f"{BASE_URL}/api/payments",
                         json={"items": [{"item_id": iid, "qty": 1}, {"item_id": mid, "qty": 2}],
                               "child_id": parent_data["child_id"], "utr": f"UTR-{RUN_TAG}"},
                         headers=_h(parent_data["token"]))
        assert r.status_code == 200, r.text
        p = r.json()
        assert p["status"] == "pending"
        assert p["has_course"] is True
        expected = price * 1 + mprice * 2
        assert abs(p["amount"] - expected) < 0.01
        assert len(p["items"]) == 2
        assert all("line_total" in li and "name" in li for li in p["items"])
        assert "_id" not in p
        parent_data["payment_id"] = p["id"]

        # admin approve
        pid = p["id"]
        rd = session.post(f"{BASE_URL}/api/admin/payments/{pid}/decide",
                          json={"decision": "approve", "admin_note": "ok"},
                          headers=_h(admin_token))
        assert rd.status_code == 200
        assert rd.json()["status"] == "approved"

        # child enrolled
        rk = session.get(f"{BASE_URL}/api/children/me", headers=_h(parent_data["token"]))
        kid = next(k for k in rk.json() if k["id"] == parent_data["child_id"])
        assert kid["enrollment_status"] == "enrolled"

    def test_payment_detail_owner_and_foreign_parent(self, session, parent_data, admin_token):
        pid = parent_data["payment_id"]
        # owner
        r = session.get(f"{BASE_URL}/api/payments/{pid}", headers=_h(parent_data["token"]))
        assert r.status_code == 200
        # admin
        r2 = session.get(f"{BASE_URL}/api/payments/{pid}", headers=_h(admin_token))
        assert r2.status_code == 200
        # foreign parent
        other_email = f"test_other_{RUN_TAG}@test.com"
        rr = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": other_email, "password": "abc1234", "name": "TEST Other",
            "child_name": "TEST O", "child_age": 7, "child_class": "2"})
        assert rr.status_code == 200
        other_tok = rr.json()["token"]
        r3 = session.get(f"{BASE_URL}/api/payments/{pid}", headers=_h(other_tok))
        assert r3.status_code == 403

    def test_enrollment_notification_with_creds(self, session, parent_data):
        time.sleep(1)
        r = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parent_data["token"]))
        assert r.status_code == 200
        items = r.json()
        enroll = [n for n in items if n["type"] == "enrollment"]
        assert enroll, "No enrollment notification"
        body = enroll[0]["body"]
        assert parent_data["user"]["user_id_code"] in body
        assert "{password}" not in body and "{user_id}" not in body
        m = re.search(r"password is\s+([A-Za-z0-9]+)", body)
        assert m, body
        parent_data["new_password"] = m.group(1).rstrip(".")

    def test_login_with_new_password(self, session, parent_data):
        r = session.post(f"{BASE_URL}/api/auth/login",
                         json={"email": PARENT_EMAIL, "password": parent_data["new_password"]})
        assert r.status_code == 200
        # refresh token
        parent_data["token"] = r.json()["token"]

    def test_second_course_payment_no_enroll_template(self, session, parent_data, admin_token):
        iid, _ = self._course_item_id(session, parent_data)
        r = session.post(f"{BASE_URL}/api/payments",
                         json={"items": [{"item_id": iid, "qty": 1}],
                               "child_id": parent_data["child_id"]},
                         headers=_h(parent_data["token"]))
        pid = r.json()["id"]
        rd = session.post(f"{BASE_URL}/api/admin/payments/{pid}/decide",
                          json={"decision": "approve"}, headers=_h(admin_token))
        assert rd.status_code == 200
        time.sleep(1)
        rn = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parent_data["token"]))
        # v3: register adds 1 welcome enrollment + first enrollment adds Welcome template = 2.
        # Second course approval must NOT add another templated welcome.
        templated = [n for n in rn.json() if n["type"] == "enrollment" and n.get("title") == "Welcome to Pragati Path"]
        assert len(templated) == 1, f"Expected 1 templated welcome, got {len(templated)}"

    def test_non_course_payment_gets_payment_approved_notif(self, session, parent_data, admin_token):
        # fresh parent to guarantee no prior state
        email3 = f"test_nocourse_{RUN_TAG}@test.com"
        rr = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": email3, "password": "abc1234", "name": "TEST NoCourse",
            "child_name": "TEST NC", "child_age": 8, "child_class": "3"})
        tok = rr.json()["token"]
        mid, _ = self._material_item_id(session, parent_data)
        rp = session.post(f"{BASE_URL}/api/payments",
                          json={"items": [{"item_id": mid, "qty": 1}]},
                          headers=_h(tok))
        assert rp.status_code == 200
        assert rp.json()["has_course"] is False
        pid = rp.json()["id"]
        rd = session.post(f"{BASE_URL}/api/admin/payments/{pid}/decide",
                          json={"decision": "approve"}, headers=_h(admin_token))
        assert rd.status_code == 200
        time.sleep(1)
        rn = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(tok))
        titles = [n["title"] for n in rn.json()]
        assert "Payment Approved" in titles
        assert "Welcome to Pragati Path" not in titles


# ---------------- Attendance ----------------
class TestAttendance:
    def test_mark_upsert_and_list(self, session, admin_token, parent_data):
        today = date.today().isoformat()
        cid = parent_data["child_id"]
        r = session.post(f"{BASE_URL}/api/admin/attendance",
                         json={"child_id": cid, "date": today, "status": "present"},
                         headers=_h(admin_token))
        assert r.status_code == 200
        # Same date again -> status updated (not duplicated)
        r2 = session.post(f"{BASE_URL}/api/admin/attendance",
                          json={"child_id": cid, "date": today, "status": "absent"},
                          headers=_h(admin_token))
        assert r2.status_code == 200
        assert r2.json()["status"] == "absent"

        # Date range filter
        frm = (date.today() - timedelta(days=1)).isoformat()
        to = (date.today() + timedelta(days=1)).isoformat()
        rl = session.get(f"{BASE_URL}/api/admin/attendance?child_id={cid}&date_from={frm}&date_to={to}",
                         headers=_h(admin_token))
        assert rl.status_code == 200
        recs = rl.json()
        assert len(recs) == 1
        assert recs[0]["status"] == "absent"

    def test_parent_view_own_child(self, session, parent_data):
        cid = parent_data["child_id"]
        r = session.get(f"{BASE_URL}/api/attendance/me?child_id={cid}", headers=_h(parent_data["token"]))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_parent_forbidden_other_child(self, session, parent_data, admin_token):
        # get some other child
        r = session.get(f"{BASE_URL}/api/admin/children", headers=_h(admin_token))
        other = next((k for k in r.json() if k["parent_id"] != parent_data["user"]["id"]), None)
        if not other:
            pytest.skip("No other child to test with")
        rr = session.get(f"{BASE_URL}/api/attendance/me?child_id={other['id']}",
                         headers=_h(parent_data["token"]))
        assert rr.status_code == 403


# ---------------- Admin stats + users ----------------
class TestAdminMeta:
    def test_stats_has_children_fields(self, session, admin_token):
        r = session.get(f"{BASE_URL}/api/admin/stats", headers=_h(admin_token))
        assert r.status_code == 200
        s = r.json()
        for k in ["pending_payments", "approved_payments", "total_users",
                  "total_children", "enrolled_children", "active_ads", "active_items"]:
            assert k in s, f"missing key {k}"
            assert isinstance(s[k], int)

    def test_users_excludes_password_and_issued(self, session, admin_token):
        r = session.get(f"{BASE_URL}/api/admin/users", headers=_h(admin_token))
        assert r.status_code == 200
        for u in r.json():
            assert u["role"] != "admin"
            assert "password_hash" not in u
            assert "issued_password" not in u
            assert "_id" not in u
