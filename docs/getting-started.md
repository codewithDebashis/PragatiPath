# Getting Started

This guide walks you through making your first API calls in under 2 minutes.

## 1. Base URL

All endpoints are prefixed with `/api`.

| Environment | Base URL |
|---|---|
| Production | `https://pragati-learning-hub.emergent.host/api` |
| Local dev | `http://localhost:8001/api` |

> Replace `<BASE>` in examples below with one of the URLs above.

## 2. Open the interactive docs

The fastest way to explore is the **Scalar reference UI**:

```
<BASE>/docs/scalar
```

Click any endpoint → fill the **Try it** form → hit **Send** to call the live API. Authentication can be set once via the lock icon at the top.

## 3. Register a parent (no auth required)

```bash
curl -X POST <BASE>/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "new.parent@example.com",
    "password": "strongpass123",
    "name": "Asha Sharma",
    "phone": "9876543210",
    "child_name": "Riya",
    "child_age": 9,
    "child_class": "4"
  }'
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "3a8b...",
    "email": "new.parent@example.com",
    "role": "parent",
    "name": "Asha Sharma",
    "user_id_code": "PP-001234"
  },
  "plain_password": "strongpass123"
}
```

Save the `token` — that's your bearer credential.

## 4. Login as an existing user

```bash
curl -X POST <BASE>/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"new.parent@example.com","password":"strongpass123"}'
```

Returns the same shape (token + user). Use email **OR** the assigned `user_id_code` (e.g. `PP-001234`) as the `email` field — both work for login.

## 5. Call a protected endpoint

Send the token in the `Authorization` header:

```bash
TOKEN="eyJhbGciOi..."
curl <BASE>/auth/me -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
{ "id": "3a8b...", "email": "new.parent@example.com", "role": "parent", "name": "Asha Sharma" }
```

## 6. Browse the shop

```bash
curl <BASE>/items -H "Authorization: Bearer $TOKEN"
```
Returns active items (courses, study materials, merch). Each item includes `description`, optional `sample_url`, and a `coming_soon` flag.

## 7. Create a payment (UPI screenshot upload)

```bash
curl -X POST <BASE>/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "child_id": "<child-uuid>",
    "items": [{"item_id":"<item-uuid>","qty":1}],
    "utr_number": "123456789012",
    "screenshot_base64": "<base64 string of the UPI confirmation screenshot>"
  }'
```

The payment lands in admin's pending queue. Once approved, the child is enrolled and the parent gets an inbox notification + push.

## 8. Admin login

Default seeded admin (do change in production!):
```
email:    admin@pragatipath.com
password: Admin@123
```

Admin endpoints live under `/api/admin/*` and require `role=admin`.

## 9. Where to go next

- **[`authentication.md`](./authentication.md)** — token lifecycle, refresh strategy
- **[`endpoints.md`](./endpoints.md)** — every endpoint with curl examples
- **[`scalar.html`](./scalar.html)** — open in browser for interactive exploration
