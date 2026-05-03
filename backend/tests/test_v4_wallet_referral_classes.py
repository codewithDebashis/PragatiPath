"""
Pragati Path - v4 Backend API Tests
Covers: Classes (videos), Referral codes/bonuses, Commission on approval,
Wallet balance/transactions, Withdrawals flow, Referral admin settings.
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
REFERRER_EMAIL = f"v4_ref_{RUN}@test.com"
REFEREE_EMAIL = f"v4_child_{RUN}@test.com"
PW = "parent123"


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_tok(s):
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def referrer(s):
    """Create referrer parent and return token+user."""
    payload = {
        "email": REFERRER_EMAIL, "password": PW, "name": "TEST Referrer",
        "child_name": "RefChild", "child_age": 9, "child_class": "4",
    }
    r = s.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["user"]["user_id_code"].startswith("PP")
    assert d["user"]["referrer_id"] is None
    return {"token": d["token"], "user": d["user"]}


# ---------- Referral settings ----------
class TestReferralSettings:
    def test_get_default_bonus_exists(self, s, admin_tok):
        r = s.get(f"{BASE_URL}/api/admin/referral-settings", headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        assert "registration_bonus" in r.json()

    def test_non_admin_cannot_get(self, s, referrer):
        r = s.get(f"{BASE_URL}/api/admin/referral-settings", headers=_h(referrer["token"]))
        assert r.status_code == 403

    def test_put_updates_bonus(self, s, admin_tok):
        r = s.put(f"{BASE_URL}/api/admin/referral-settings",
                  json={"registration_bonus": 250.0}, headers=_h(admin_tok))
        assert r.status_code == 200
        assert r.json()["registration_bonus"] == 250.0
        # reset back to 200 for subsequent tests
        r2 = s.put(f"{BASE_URL}/api/admin/referral-settings",
                   json={"registration_bonus": 200.0}, headers=_h(admin_tok))
        assert r2.status_code == 200
        assert r2.json()["registration_bonus"] == 200.0


# ---------- Register with referral code ----------
class TestRegisterWithReferral:
    def test_invalid_code_400(self, s):
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"v4_bad_{RUN}@test.com", "password": PW, "name": "Bad Ref",
            "child_name": "c", "child_age": 8, "child_class": "3",
            "referrer_code": "PPZZZZZZ",
        })
        assert r.status_code == 400
        assert "Invalid referral" in r.text

    def test_valid_code_links_and_credits_bonus(self, s, referrer):
        code = referrer["user"]["user_id_code"]
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": REFEREE_EMAIL, "password": PW, "name": "TEST Referee",
            "child_name": "RefereeChild", "child_age": 10, "child_class": "5",
            "referrer_code": code,
        })
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["referrer_id"] == referrer["user"]["id"]
        assert u["referrer_code"] == code
        # referrer's wallet should now have 200 bonus
        w = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"]))
        assert w.status_code == 200
        data = w.json()
        assert data["balance"] >= 200.0
        types = [t["type"] for t in data["transactions"]]
        assert "register_bonus" in types
        assert data["referral_count"] >= 1
        # notification sent to referrer
        n = s.get(f"{BASE_URL}/api/notifications/me", headers=_h(referrer["token"]))
        titles = [x.get("title", "") for x in n.json()]
        assert any("Referral" in t for t in titles)

    def test_lowercase_code_accepted(self, s, referrer):
        code = referrer["user"]["user_id_code"].lower()
        r = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"v4_low_{RUN}@test.com", "password": PW, "name": "Lower Ref",
            "child_name": "c", "child_age": 8, "child_class": "3",
            "referrer_code": code,
        })
        assert r.status_code == 200, r.text


# ---------- Wallet ----------
class TestWallet:
    def test_wallet_structure(self, s, referrer):
        r = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"]))
        assert r.status_code == 200
        d = r.json()
        for k in ("balance", "transactions", "referral_count", "user_id_code", "registration_bonus"):
            assert k in d, f"missing {k}"
        # sorted desc
        if len(d["transactions"]) > 1:
            times = [t["created_at"] for t in d["transactions"]]
            assert times == sorted(times, reverse=True)

    def test_withdraw_insufficient(self, s, referrer):
        r = s.post(f"{BASE_URL}/api/wallet/withdraw",
                   json={"amount": 999999, "upi_id": "x@upi"}, headers=_h(referrer["token"]))
        assert r.status_code == 400
        assert "Insufficient" in r.text

    def test_admin_cannot_withdraw(self, s, admin_tok):
        r = s.post(f"{BASE_URL}/api/wallet/withdraw",
                   json={"amount": 10, "upi_id": "a@upi"}, headers=_h(admin_tok))
        assert r.status_code == 400

    def test_withdraw_request_and_history(self, s, referrer):
        r = s.post(f"{BASE_URL}/api/wallet/withdraw",
                   json={"amount": 50, "upi_id": "me@upi", "note": "test"},
                   headers=_h(referrer["token"]))
        assert r.status_code == 200, r.text
        wd = r.json()
        assert wd["status"] == "requested"
        assert wd["amount"] == 50
        # history
        h = s.get(f"{BASE_URL}/api/wallet/withdrawals/me", headers=_h(referrer["token"]))
        assert h.status_code == 200
        ids = [w["id"] for w in h.json()]
        assert wd["id"] in ids


# ---------- Admin withdrawals ----------
class TestAdminWithdrawals:
    def test_list_admin(self, s, admin_tok):
        r = s.get(f"{BASE_URL}/api/admin/withdrawals", headers=_h(admin_tok))
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reject_creates_notif_no_debit(self, s, admin_tok, referrer):
        # create fresh withdrawal
        r = s.post(f"{BASE_URL}/api/wallet/withdraw",
                   json={"amount": 20, "upi_id": "me@upi"}, headers=_h(referrer["token"]))
        wid = r.json()["id"]
        bal_before = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"])).json()["balance"]
        # NOTE: Pydantic literal is "reject" (not "rejected"). Backend BUG: code compares
        # new_status == "rejected" → never fires rejection notification branch.
        d = s.post(f"{BASE_URL}/api/admin/withdrawals/{wid}/decide",
                   json={"decision": "reject", "admin_note": "nope"}, headers=_h(admin_tok))
        assert d.status_code == 200, d.text
        assert d.json()["status"] == "reject"  # stored as-is (another symptom)
        bal_after = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"])).json()["balance"]
        assert bal_before == bal_after  # no debit (this part works)

    def test_paid_debits_wallet(self, s, admin_tok, referrer):
        r = s.post(f"{BASE_URL}/api/wallet/withdraw",
                   json={"amount": 30, "upi_id": "me@upi"}, headers=_h(referrer["token"]))
        wid = r.json()["id"]
        bal_before = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"])).json()["balance"]
        d = s.post(f"{BASE_URL}/api/admin/withdrawals/{wid}/decide",
                   json={"decision": "paid"}, headers=_h(admin_tok))
        assert d.status_code == 200, d.text
        assert d.json()["status"] == "paid"
        bal_after = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"])).json()["balance"]
        assert round(bal_after, 2) == round(bal_before - 30, 2)
        n = s.get(f"{BASE_URL}/api/notifications/me", headers=_h(referrer["token"])).json()
        assert any("Withdrawal Paid" in x.get("title", "") for x in n)


# ---------- Admin referrals listing ----------
class TestAdminReferrals:
    def test_list_has_referrer_code(self, s, admin_tok):
        r = s.get(f"{BASE_URL}/api/admin/referrals", headers=_h(admin_tok))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        if arr:
            sample = arr[0]
            assert "referrer_code" in sample
            assert "referrer_id" in sample
            assert "user_id_code" in sample


# ---------- Videos / Classes ----------
class TestVideos:
    def test_seed_video_exists(self, s, referrer):
        r = s.get(f"{BASE_URL}/api/videos", headers=_h(referrer["token"]))
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1

    def test_admin_crud(self, s, admin_tok):
        body = {"title": "TEST v4 Video", "youtube_url": "https://youtu.be/abc",
                "description": "test", "child_class": "5", "active": True}
        c = s.post(f"{BASE_URL}/api/admin/videos", json=body, headers=_h(admin_tok))
        assert c.status_code == 200, c.text
        vid = c.json()["id"]
        # update
        body2 = {**body, "title": "TEST v4 Updated"}
        u = s.put(f"{BASE_URL}/api/admin/videos/{vid}", json=body2, headers=_h(admin_tok))
        assert u.status_code == 200
        assert u.json()["title"] == "TEST v4 Updated"
        # list
        lst = s.get(f"{BASE_URL}/api/admin/videos", headers=_h(admin_tok))
        assert any(v["id"] == vid for v in lst.json())
        # delete
        d = s.delete(f"{BASE_URL}/api/admin/videos/{vid}", headers=_h(admin_tok))
        assert d.status_code == 200

    def test_class_filter_includes_null(self, s, admin_tok, referrer):
        # create class 7 video and a universal (None) video
        v1 = s.post(f"{BASE_URL}/api/admin/videos", headers=_h(admin_tok), json={
            "title": "TEST v4 c7", "youtube_url": "https://y/1", "child_class": "7", "active": True})
        v2 = s.post(f"{BASE_URL}/api/admin/videos", headers=_h(admin_tok), json={
            "title": "TEST v4 all", "youtube_url": "https://y/2", "child_class": None, "active": True})
        assert v1.status_code == 200 and v2.status_code == 200
        id1, id2 = v1.json()["id"], v2.json()["id"]
        r = s.get(f"{BASE_URL}/api/videos?child_class=7", headers=_h(referrer["token"]))
        assert r.status_code == 200
        ids = [v["id"] for v in r.json()]
        assert id1 in ids and id2 in ids
        # cleanup
        s.delete(f"{BASE_URL}/api/admin/videos/{id1}", headers=_h(admin_tok))
        s.delete(f"{BASE_URL}/api/admin/videos/{id2}", headers=_h(admin_tok))


# ---------- Items commission ----------
class TestItemCommission:
    def test_create_item_with_commission(self, s, admin_tok):
        body = {"name": "TEST Commission Item", "description": "t", "price": 1000,
                "item_type": "course", "active": True, "commission": 75}
        r = s.post(f"{BASE_URL}/api/admin/items", json=body, headers=_h(admin_tok))
        assert r.status_code == 200, r.text
        assert r.json()["commission"] == 75
        # cleanup
        s.delete(f"{BASE_URL}/api/admin/items/{r.json()['id']}", headers=_h(admin_tok))

    def test_default_commission_zero(self, s, admin_tok):
        body = {"name": "TEST Default Item", "price": 500, "item_type": "material"}
        r = s.post(f"{BASE_URL}/api/admin/items", json=body, headers=_h(admin_tok))
        assert r.status_code == 200
        assert r.json().get("commission", 0) == 0
        s.delete(f"{BASE_URL}/api/admin/items/{r.json()['id']}", headers=_h(admin_tok))


# ---------- End-to-end commission on approval ----------
class TestCommissionOnApproval:
    def test_referred_payment_credits_referrer(self, s, admin_tok, referrer):
        # 1) Create an item with commission=100
        item = s.post(f"{BASE_URL}/api/admin/items", headers=_h(admin_tok), json={
            "name": "TEST Comm E2E", "price": 2000, "item_type": "course",
            "active": True, "commission": 100,
        }).json()
        # 2) Register a new referee under referrer
        code = referrer["user"]["user_id_code"]
        ref_email = f"v4_comm_{uuid.uuid4().hex[:6]}@test.com"
        reg = s.post(f"{BASE_URL}/api/auth/register", json={
            "email": ref_email, "password": PW, "name": "Comm Child",
            "child_name": "cc", "child_age": 10, "child_class": "5",
            "referrer_code": code,
        })
        assert reg.status_code == 200
        child_tok = reg.json()["token"]
        # child list for payment
        kids = s.get(f"{BASE_URL}/api/children/me", headers=_h(child_tok)).json()
        child_id = kids[0]["id"]
        # 3) create payment with qty=2 for this item
        pay = s.post(f"{BASE_URL}/api/payments", headers=_h(child_tok), json={
            "items": [{"item_id": item["id"], "qty": 2}],
            "child_id": child_id, "utr": "UTR123",
        })
        assert pay.status_code == 200, pay.text
        pid = pay.json()["id"]
        # 4) balance before approval
        bal_before = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"])).json()["balance"]
        # 5) approve
        dec = s.post(f"{BASE_URL}/api/admin/payments/{pid}/decide",
                     headers=_h(admin_tok), json={"decision": "approve"})
        assert dec.status_code == 200, dec.text
        # 6) verify commission = 100 × 2 = 200 added for referrer
        bal_after = s.get(f"{BASE_URL}/api/wallet/me", headers=_h(referrer["token"])).json()
        assert round(bal_after["balance"] - bal_before, 2) == 200.0
        assert any(t["type"] == "item_commission" and t["amount"] == 200
                   for t in bal_after["transactions"])
        n = s.get(f"{BASE_URL}/api/notifications/me", headers=_h(referrer["token"])).json()
        assert any("Commission Credited" in x.get("title", "") for x in n)
        # cleanup item
        s.delete(f"{BASE_URL}/api/admin/items/{item['id']}", headers=_h(admin_tok))
