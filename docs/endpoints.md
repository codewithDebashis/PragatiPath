# Endpoint Catalogue

All 47 endpoints grouped by tag. For full request/response schemas, open the **[Scalar UI](./scalar.html)** or the live `/api/docs/scalar`.

> Convention: `🔓` = no auth · `🔒` = parent or admin · `👑` = admin only

---

## 🔐 Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | 🔓 | Create new parent + first child, return token |
| POST | `/api/auth/login` | 🔓 | Login by email or user_id_code |
| GET  | `/api/auth/me` | 🔒 | Current user profile |

### Example
```bash
curl -X POST <BASE>/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@pragatipath.com","password":"Admin@123"}'
```

---

## 👨‍👩‍👧 Children

| Method | Path | Auth | Description |
|---|---|---|---|
| GET    | `/api/children/me` | 🔒 | List my children |
| POST   | `/api/children` | 🔒 | Add another child |
| PATCH  | `/api/children/{id}` | 🔒 | Update child details |
| DELETE | `/api/children/{id}` | 🔒 | Remove child |

---

## 🛒 Shop

| Method | Path | Auth | Description |
|---|---|---|---|
| GET    | `/api/items` | 🔒 | Active items list |
| GET    | `/api/admin/items` | 👑 | All items incl. inactive |
| POST   | `/api/admin/items` | 👑 | Create item |
| PUT    | `/api/admin/items/{id}` | 👑 | Update item |
| DELETE | `/api/admin/items/{id}` | 👑 | Delete item |

**Item fields:** `name`, `description`, `price`, `item_type` (course/material/merch/other), `image_base64`, `sample_url`, `sample_image_base64`, `coming_soon`, `commission`, `active`.

---

## 💰 Payments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST   | `/api/payments` | 🔒 | Submit UPI screenshot + UTR |
| GET    | `/api/payments/me` | 🔒 | My payment history |
| GET    | `/api/payments/{id}` | 🔒 | Payment + receipt detail |
| GET    | `/api/admin/payments` | 👑 | All payments (filter `?status=pending`) |
| POST   | `/api/admin/payments/{id}/decide` | 👑 | Approve/reject — auto-enrols child |

---

## 📋 Attendance

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/api/attendance/child/{child_id}` | 🔒 | View child's attendance |
| POST | `/api/admin/attendance` | 👑 | Mark present/absent/leave |

---

## 📥 Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/api/notifications/me` | 🔒 | Inbox |
| POST | `/api/notifications/{id}/read` | 🔒 | Mark single notification read |
| POST | `/api/notifications/read-all` | 🔒 | Mark all read |
| POST | `/api/admin/notifications` | 👑 | Compose to one/all parents (push fires automatically) |

---

## 🎬 Videos

| Method | Path | Auth | Description |
|---|---|---|---|
| GET    | `/api/videos` | 🔒 | All published videos |
| POST   | `/api/admin/videos` | 👑 | Add video (YouTube ID + title) |
| DELETE | `/api/admin/videos/{id}` | 👑 | Remove video |

---

## 💸 Wallet

| Method | Path | Auth | Description |
|---|---|---|---|
| GET  | `/api/wallet/me` | 🔒 | Balance + transactions |
| POST | `/api/wallet/withdraw` | 🔒 | Request withdrawal (UPI ID) |
| GET  | `/api/admin/withdrawals` | 👑 | All withdrawal requests |
| POST | `/api/admin/withdrawals/{id}/decide` | 👑 | Approve/reject withdrawal |

---

## 🔗 Referrals

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/referrals/me` | 🔒 | My referral code, count, earnings, share URL |

---

## ⭐ Feedback

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/feedback` | 🔒 | Submit rating (1-5) or suggestion |
| GET  | `/api/feedback/me` | 🔒 | My feedback history (with admin replies) |
| GET  | `/api/feedback/me/rated` | 🔒 | `{rated, rating}` |
| GET  | `/api/feedback/me/engaged` | 🔒 | `{engaged}` — true if user gave any feedback |
| GET  | `/api/admin/feedback` | 👑 | All feedback (filter `?type=rating\|suggestion`) + avg rating |
| POST | `/api/admin/feedback/{id}/reply` | 👑 | Reply to a suggestion (notifies user + push) |

---

## 📱 Push

| Method | Path | Auth | Description |
|---|---|---|---|
| POST   | `/api/users/me/push-token` | 🔒 | Save Expo push token |
| DELETE | `/api/users/me/push-token` | 🔒 | Remove push token (on logout) |

---

## 👑 Admin (misc)

| Method | Path | Description |
|---|---|---|
| GET    | `/api/admin/users` | List parents with children + balances |
| POST   | `/api/admin/users/{id}/reset-password` | Reset (auto or custom) |
| GET    | `/api/admin/stats` | Dashboard counters |
| POST   | `/api/admin/upi` | Set UPI ID + QR code base64 |
| POST   | `/api/admin/ads` | Update advertisement banner |
| POST   | `/api/admin/template` | Update welcome message template |

---

## 🔓 Public

| Method | Path | Description |
|---|---|---|
| GET | `/api/upi-settings` | UPI ID + QR (used on payment screen pre-login if needed) |
| GET | `/api/ads/active` | Public banner ad |
| GET | `/api/` | Health check |

---

> 💡 For a clickable, searchable, "Try it out" version of all of this, open **[`scalar.html`](./scalar.html)** in your browser.
