# Error Format

All errors return a JSON body with a `detail` field.

```json
{ "detail": "Invalid email or password" }
```

Validation errors (Pydantic) follow OpenAPI's standard:
```json
{
  "detail": [
    { "loc": ["body", "password"], "msg": "field required", "type": "missing" }
  ]
}
```

## Common HTTP codes

| Code | Meaning | Typical cause |
|---|---|---|
| **200** | OK | Successful operation |
| **400** | Bad request | Business rule violation (e.g., "item is coming soon and cannot be purchased") |
| **401** | Unauthorized | Missing / invalid / expired bearer token |
| **403** | Forbidden | Authenticated, but role lacks permission (e.g., parent on admin route) |
| **404** | Not found | Resource doesn't exist or you don't own it |
| **409** | Conflict | Email already registered |
| **422** | Unprocessable entity | Pydantic validation failed (wrong type, range, etc.) |
| **500** | Server error | Unexpected — file an issue with the request id |

## Common error messages

| Endpoint | Message | Why |
|---|---|---|
| `POST /auth/login` | `Invalid email or password` | Wrong creds |
| `POST /auth/register` | `Email already registered` | Duplicate email |
| `POST /payments` | `'X' is coming soon and cannot be purchased yet` | Item has `coming_soon: true` |
| `POST /admin/feedback/{id}/reply` | `Feedback not found` | Bad id |
| `POST /feedback` | `Admins cannot submit feedback` | Use a parent account |
| `POST /feedback` | `Rating is required` / `Message is required for suggestion` | Missing required field |
| Any admin route | `Forbidden` | Role mismatch |

## Push notification failures

Push calls to Expo's push service are **best-effort** — failures (bad token, Expo down) are silently logged on the server. They never cause the originating request (e.g., a payment approval) to fail.
