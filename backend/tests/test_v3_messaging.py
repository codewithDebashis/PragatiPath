"""
Pragati Path - v3 Messaging Tests
- Welcome inbox notification with user_id_code & password
- Admin send messages (all / specific user / 403 / 400 / 404 / image)
"""
import os
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
RUN = uuid.uuid4().hex[:6]


def _h(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def parentA(session):
    email = f"v3_parentA_{RUN}@test.com"
    pwd = "p@ssA12345"
    r = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": pwd, "name": "TEST V3 A",
        "child_name": "TEST KidA", "child_age": 8, "child_class": "3"
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "password": pwd}


@pytest.fixture(scope="module")
def parentB(session):
    email = f"v3_parentB_{RUN}@test.com"
    pwd = "p@ssB12345"
    r = session.post(f"{BASE_URL}/api/auth/register", json={
        "email": email, "password": pwd, "name": "TEST V3 B",
        "child_name": "TEST KidB", "child_age": 9, "child_class": "4"
    })
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "password": pwd}


# 1x1 transparent PNG
TINY_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+9b3w"
    "wAAAAABJRU5ErkJggg=="
)


class TestWelcomeNotification:
    def test_register_creates_welcome_inbox_with_creds(self, session, parentA):
        r = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parentA["token"]))
        assert r.status_code == 200
        items = r.json()
        enroll = [n for n in items if n["type"] == "enrollment"]
        assert enroll, "No enrollment-type notification found"
        # The v3 welcome one
        welcome = [n for n in enroll if "Account Created" in n.get("title", "")]
        assert welcome, f"No 'Account Created' welcome notif. titles={[n['title'] for n in enroll]}"
        n = welcome[0]
        assert parentA["user"]["user_id_code"] in n["body"]
        assert parentA["password"] in n["body"]
        assert n["read"] is False
        assert "_id" not in n


class TestAdminSendAll:
    def test_send_all_creates_for_each_parent(self, session, admin_token, parentA, parentB):
        title = f"TEST V3 All {RUN}"
        body = "Hello to all parents"
        r = session.post(f"{BASE_URL}/api/admin/notifications",
                         json={"title": title, "body": body, "recipient": "all"},
                         headers=_h(admin_token))
        assert r.status_code == 200, r.text
        sent = r.json()["sent"]
        assert sent >= 2

        for parent in (parentA, parentB):
            rn = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parent["token"]))
            assert rn.status_code == 200
            matches = [n for n in rn.json() if n["title"] == title]
            assert matches, f"Parent {parent['user']['email']} did not receive admin 'all' notif"
            n = matches[0]
            assert n["type"] == "admin"
            assert n["body"] == body
            assert n["read"] is False


class TestAdminSendSpecific:
    def test_user_recipient_missing_user_id_400(self, session, admin_token):
        r = session.post(f"{BASE_URL}/api/admin/notifications",
                         json={"title": "x", "body": "y", "recipient": "user"},
                         headers=_h(admin_token))
        assert r.status_code == 400

    def test_unknown_user_id_404(self, session, admin_token):
        r = session.post(f"{BASE_URL}/api/admin/notifications",
                         json={"title": "x", "body": "y", "recipient": "user", "user_id": "nope-not-real"},
                         headers=_h(admin_token))
        assert r.status_code == 404

    def test_send_to_specific_with_image_excludes_others(self, session, admin_token, parentA, parentB):
        title = f"TEST V3 Solo {RUN}"
        r = session.post(f"{BASE_URL}/api/admin/notifications",
                         json={"title": title, "body": "Just for A",
                               "recipient": "user", "user_id": parentA["user"]["id"],
                               "image_base64": TINY_PNG_B64},
                         headers=_h(admin_token))
        assert r.status_code == 200, r.text
        assert r.json()["sent"] == 1

        # parentA receives it with image stored
        ra = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parentA["token"]))
        a_match = [n for n in ra.json() if n["title"] == title]
        assert a_match, "Targeted parent did not receive message"
        assert a_match[0]["type"] == "admin"
        assert a_match[0].get("image_base64") == TINY_PNG_B64

        # parentB must NOT receive it
        rb = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parentB["token"]))
        b_match = [n for n in rb.json() if n["title"] == title]
        assert not b_match, "Non-target parent incorrectly received the user-specific message"


class TestAdminAuth:
    def test_parent_forbidden(self, session, parentA):
        r = session.post(f"{BASE_URL}/api/admin/notifications",
                         json={"title": "hack", "body": "no", "recipient": "all"},
                         headers=_h(parentA["token"]))
        assert r.status_code == 403


class TestMarkRead:
    def test_mark_read_reduces_unread(self, session, parentA):
        rn = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parentA["token"]))
        unread_before = [n for n in rn.json() if not n["read"]]
        assert unread_before, "Need at least one unread notif"
        nid = unread_before[0]["id"]
        rr = session.post(f"{BASE_URL}/api/notifications/{nid}/read", headers=_h(parentA["token"]))
        assert rr.status_code == 200
        rn2 = session.get(f"{BASE_URL}/api/notifications/me", headers=_h(parentA["token"]))
        unread_after = [n for n in rn2.json() if not n["read"]]
        assert len(unread_after) == len(unread_before) - 1
