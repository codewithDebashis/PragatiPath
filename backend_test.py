"""
Backend tests for Pragati Path coaching centre app.
Focus: Items CRUD with description/sample_url/sample_image_base64
       and regression of auth + payments + shop flow.
"""
import os
import sys
import uuid
import time
import json
import requests
from pathlib import Path

# Read EXPO_PUBLIC_BACKEND_URL from frontend/.env
ENV_FILE = Path("/app/frontend/.env")
BASE_URL = None
for line in ENV_FILE.read_text().splitlines():
    line = line.strip()
    if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
        BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
        break

if not BASE_URL:
    print("ERROR: EXPO_PUBLIC_BACKEND_URL missing in /app/frontend/.env")
    sys.exit(1)

API = BASE_URL.rstrip("/") + "/api"
print(f"Using API base: {API}")

ADMIN_EMAIL = "admin@pragatipath.com"
ADMIN_PASSWORD = "Admin@123"

results = []


def record(name, ok, detail=""):
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}{(' — ' + detail) if detail else ''}")
    results.append({"name": name, "ok": ok, "detail": detail})
    return ok


def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def main():
    # ---------- 1) Admin login ----------
    r = requests.post(
        f"{API}/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    if not record("Admin login", r.status_code == 200, f"status={r.status_code} body={r.text[:200]}"):
        return
    admin_token = r.json()["token"]
    admin_user = r.json()["user"]
    record("Admin role==admin", admin_user.get("role") == "admin", str(admin_user.get("role")))

    # ---------- 2) Parent register ----------
    suffix = uuid.uuid4().hex[:8]
    parent_email = f"riya.sharma+{suffix}@pragatitest.in"
    parent_password = "Parent@12345"
    parent_payload = {
        "email": parent_email,
        "password": parent_password,
        "name": "Riya Sharma",
        "phone": "9876543210",
        "child_name": "Aanya Sharma",
        "child_age": 9,
        "child_class": "4",
    }
    r = requests.post(f"{API}/auth/register", json=parent_payload, timeout=30)
    if not record("Parent register", r.status_code == 200, f"status={r.status_code} body={r.text[:300]}"):
        return
    parent_token = r.json()["token"]
    parent_user = r.json()["user"]

    # ---------- 3) Parent login ----------
    r = requests.post(
        f"{API}/auth/login",
        json={"email": parent_email, "password": parent_password},
        timeout=30,
    )
    record("Parent login", r.status_code == 200, f"status={r.status_code}")

    # ---------- 4) /auth/me ----------
    r = requests.get(f"{API}/auth/me", headers=headers(parent_token), timeout=30)
    record(
        "GET /auth/me parent",
        r.status_code == 200 and r.json().get("email") == parent_email,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # ---------- 5) Items CRUD with new fields ----------
    sample_image_b64 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9X4r"
        "tw0AAAAASUVORK5CYII="
    )
    create_payload = {
        "name": f"Class 5 Sample Notes {suffix}",
        "description": "Comprehensive printed notes for Class 5 covering Maths, Science, English.",
        "price": 799.0,
        "item_type": "material",
        "sample_url": "https://drive.google.com/file/d/abc/view",
        "sample_image_base64": sample_image_b64,
        "commission": 50.0,
        "active": True,
    }
    r = requests.post(
        f"{API}/admin/items",
        headers=headers(admin_token),
        data=json.dumps(create_payload),
        timeout=30,
    )
    if not record(
        "POST /admin/items (with description+sample fields)",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:300]}",
    ):
        return
    item = r.json()
    item_id = item["id"]
    record(
        "Created item contains description",
        item.get("description") == create_payload["description"],
        repr(item.get("description"))[:80],
    )
    record(
        "Created item contains sample_url",
        item.get("sample_url") == create_payload["sample_url"],
        repr(item.get("sample_url"))[:80],
    )
    record(
        "Created item contains sample_image_base64",
        item.get("sample_image_base64") == sample_image_b64,
        f"len={len(item.get('sample_image_base64') or '')}",
    )

    # GET /admin/items
    r = requests.get(f"{API}/admin/items", headers=headers(admin_token), timeout=30)
    found = None
    if r.status_code == 200:
        for it in r.json():
            if it.get("id") == item_id:
                found = it
                break
    record(
        "GET /admin/items lists new item with new fields",
        bool(
            found
            and found.get("description") == create_payload["description"]
            and found.get("sample_url") == create_payload["sample_url"]
            and found.get("sample_image_base64") == sample_image_b64
        ),
        "missing fields" if not found else "ok",
    )

    # GET /items as parent
    r = requests.get(f"{API}/items", headers=headers(parent_token), timeout=30)
    p_found = None
    if r.status_code == 200:
        for it in r.json():
            if it.get("id") == item_id:
                p_found = it
                break
    record(
        "GET /items (parent) returns new item with new fields",
        bool(
            p_found
            and p_found.get("description") == create_payload["description"]
            and p_found.get("sample_url") == create_payload["sample_url"]
            and p_found.get("sample_image_base64") == sample_image_b64
        ),
        "missing fields" if not p_found else "ok",
    )

    # PUT /admin/items/{id} update description + sample_url
    upd_payload = dict(create_payload)
    upd_payload["description"] = "UPDATED: notes now include extra olympiad worksheets."
    upd_payload["sample_url"] = "https://drive.google.com/file/d/xyz/view"
    r = requests.put(
        f"{API}/admin/items/{item_id}",
        headers=headers(admin_token),
        data=json.dumps(upd_payload),
        timeout=30,
    )
    upd = r.json() if r.status_code == 200 else {}
    record(
        "PUT /admin/items/{id} updates description+sample_url",
        r.status_code == 200
        and upd.get("description") == upd_payload["description"]
        and upd.get("sample_url") == upd_payload["sample_url"],
        f"status={r.status_code} body={r.text[:200]}",
    )

    # Backward compatibility: POST without description/sample fields
    bc_payload = {
        "name": f"Plain item {suffix}",
        "price": 200.0,
        "item_type": "merch",
        "active": True,
        "commission": 0.0,
    }
    r = requests.post(
        f"{API}/admin/items",
        headers=headers(admin_token),
        data=json.dumps(bc_payload),
        timeout=30,
    )
    bc_ok = r.status_code == 200
    bc_item_id = r.json()["id"] if bc_ok else None
    record(
        "POST /admin/items without description/sample (backward compat)",
        bc_ok,
        f"status={r.status_code} body={r.text[:200]}",
    )

    # ---------- 6) Payments / shop flow ----------
    # Get child id
    r = requests.get(f"{API}/children/me", headers=headers(parent_token), timeout=30)
    child_id = None
    if r.status_code == 200 and r.json():
        child_id = r.json()[0]["id"]
    record("GET /children/me returns child", child_id is not None, f"status={r.status_code}")

    # Create payment referencing the new item
    pay_payload = {
        "items": [{"item_id": item_id, "qty": 1}],
        "child_id": child_id,
        "utr": f"UTR{uuid.uuid4().hex[:10].upper()}",
        "screenshot_base64": sample_image_b64,
        "note": "Paid via PhonePe",
    }
    r = requests.post(
        f"{API}/payments",
        headers=headers(parent_token),
        data=json.dumps(pay_payload),
        timeout=30,
    )
    if not record(
        "POST /payments (parent)",
        r.status_code == 200,
        f"status={r.status_code} body={r.text[:300]}",
    ):
        return
    payment = r.json()
    payment_id = payment["id"]
    record(
        "Payment amount matches item price",
        abs(float(payment.get("amount", 0)) - 799.0) < 1e-6,
        str(payment.get("amount")),
    )

    # Admin: pending list contains the payment
    r = requests.get(
        f"{API}/admin/payments?status=pending",
        headers=headers(admin_token),
        timeout=30,
    )
    has_payment = False
    if r.status_code == 200:
        has_payment = any(p.get("id") == payment_id for p in r.json())
    record(
        "GET /admin/payments?status=pending contains payment",
        has_payment,
        f"status={r.status_code}",
    )

    # Admin approve
    r = requests.post(
        f"{API}/admin/payments/{payment_id}/decide",
        headers=headers(admin_token),
        data=json.dumps({"decision": "approve", "admin_note": "Verified"}),
        timeout=30,
    )
    record(
        "POST /admin/payments/{id}/decide approve",
        r.status_code == 200 and r.json().get("status") == "approved",
        f"status={r.status_code} body={r.text[:200]}",
    )

    # Notifications for parent should include payment-approved (item is material, not course)
    time.sleep(0.5)
    r = requests.get(f"{API}/notifications/me", headers=headers(parent_token), timeout=30)
    has_notif = False
    if r.status_code == 200:
        for n in r.json():
            if n.get("title") in ("Payment Approved", "Child Enrolled") or "approved" in (n.get("body") or "").lower():
                has_notif = True
                break
    record(
        "GET /notifications/me contains approval notification",
        has_notif,
        f"status={r.status_code}",
    )

    # ---------- Cleanup items ----------
    r = requests.delete(f"{API}/admin/items/{item_id}", headers=headers(admin_token), timeout=30)
    record("DELETE /admin/items/{id} cleanup new item", r.status_code == 200, f"status={r.status_code}")
    if bc_item_id:
        r = requests.delete(
            f"{API}/admin/items/{bc_item_id}", headers=headers(admin_token), timeout=30
        )
        record(
            "DELETE /admin/items/{id} cleanup backward compat item",
            r.status_code == 200,
            f"status={r.status_code}",
        )


if __name__ == "__main__":
    try:
        main()
    finally:
        passed = sum(1 for r in results if r["ok"])
        failed = [r for r in results if not r["ok"]]
        print("\n========== SUMMARY ==========")
        print(f"Total: {len(results)}  Pass: {passed}  Fail: {len(failed)}")
        for f in failed:
            print(f" - FAIL: {f['name']} :: {f['detail']}")
        sys.exit(0 if not failed else 1)
