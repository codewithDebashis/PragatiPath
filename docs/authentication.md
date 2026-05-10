# Authentication

The Pragati Path API uses **JWT bearer tokens** signed with HS256.

## Token lifecycle

| Property | Value |
|---|---|
| Algorithm | HS256 |
| Expiry | **30 days** from issuance |
| Refresh | Re-login (no refresh-token endpoint) |
| Storage (mobile app) | `AsyncStorage` key `pp_token` |
| Header name | `Authorization` |
| Scheme | `Bearer <token>` |

## Obtaining a token

Two entry points return a token:

### POST `/api/auth/register`
Creates a new parent + first child. Body:
```json
{
  "email": "parent@example.com",
  "password": "strong123",
  "name": "Parent Name",
  "phone": "9876543210",
  "child_name": "Kid Name",
  "child_age": 8,
  "child_class": "3",
  "referrer_code": "PP-001234"  // optional — credits commission to that referrer
}
```

### POST `/api/auth/login`
Authenticate existing users.
```json
{ "email": "parent@example.com OR PP-001234", "password": "strong123" }
```
Login accepts either the email **or** the `user_id_code`.

## Sending the token

Every protected request must include:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

In JavaScript / axios:
```js
const api = axios.create({
  baseURL: 'https://pragati-learning-hub.emergent.host/api',
  headers: { Authorization: `Bearer ${token}` }
});
```

In Python / requests:
```python
import requests
headers = {'Authorization': f'Bearer {token}'}
requests.get('<BASE>/auth/me', headers=headers)
```

## Roles

| Role | How assigned | Capabilities |
|---|---|---|
| `parent` | Default for `/auth/register` | Manage own children, shop, payments, wallet, feedback |
| `admin` | Seeded on first startup (`admin@pragatipath.com / Admin@123`) | All `/admin/*` routes — approve payments, manage items, send messages, etc. |

A route guarded by admin role returns **HTTP 403** if a parent token is presented.

## Token expiry & errors

| Status | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | No token, malformed token, or expired | Re-login |
| `403 Forbidden` | Valid parent token on admin route | Use admin credentials |
| `404 Not Found` | Resource id doesn't exist or doesn't belong to your account | Verify id and ownership |

## Password reset

Admins can reset any user's password via:
```
POST /api/admin/users/{user_id}/reset-password
body: { "new_password": "NewPass!23" } | { "auto": true }
```
When `auto: true`, a random 8-char password is generated and returned in the response. The user is also notified via inbox + push.

## Push token registration

After login on a real device, the mobile app calls:
```
POST /api/users/me/push-token
body: { "push_token": "ExponentPushToken[xxx]", "platform": "android" }
```
This associates the device with the user so payment-approved / message / feedback-reply events can fire push notifications via the Expo Push Service.

## Security notes

- All passwords are **bcrypt-hashed** (cost factor 12) before storage
- The plaintext password is **only echoed back on `/register` and `/admin/.../reset-password?auto=true`** so the welcome popup can show it once
- `JWT_SECRET` is loaded from `backend/.env` — rotate it carefully (will invalidate all tokens)
- CORS allows all origins (`*`) since the API is consumed by mobile + web preview
