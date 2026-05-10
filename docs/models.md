# Data Models

Key request / response schemas. (Full JSON Schema is in [`openapi.json`](./openapi.json) under `components.schemas`.)

## User
```json
{
  "id": "3a8b-uuid",
  "email": "parent@example.com",
  "role": "parent",            // "parent" | "admin"
  "name": "Asha Sharma",
  "phone": "9876543210",
  "user_id_code": "PP-001234",  // human-friendly login id
  "created_at": "2025-05-08T10:30:00+00:00"
}
```

## Child
```json
{
  "id": "7c3e-uuid",
  "parent_id": "3a8b-uuid",
  "name": "Riya Sharma",
  "age": 9,
  "class_name": "4",            // "1" through "10"
  "enrollment_status": "pending", // "pending" | "enrolled"
  "child_id_code": "PPC-005678"
}
```

## Item (shop)
```json
{
  "id": "item-uuid",
  "name": "Foundation Course (Class 1-5)",
  "description": "Full year curriculum with weekly tests",
  "price": 5000.0,
  "item_type": "course",         // course | material | merch | other
  "image_base64": "<optional>",
  "sample_url": "https://...pdf",  // optional preview link
  "sample_image_base64": null,     // OR an inline preview image
  "coming_soon": false,            // if true, parents see badge & cannot purchase
  "commission": 500.0,             // ₹ paid to referrer on approval
  "active": true,
  "created_at": "..."
}
```

## Payment
```json
{
  "id": "pay-uuid",
  "user_id": "3a8b-uuid",
  "child_id": "7c3e-uuid",
  "items": [{ "item_id": "...", "qty": 1, "price": 5000 }],
  "amount": 5000.0,
  "utr_number": "123456789012",
  "screenshot_base64": "<png/jpg base64>",
  "status": "pending",            // pending | approved | rejected
  "admin_note": null,
  "created_at": "...",
  "decided_at": null
}
```

## Notification
```json
{
  "id": "notif-uuid",
  "user_id": "3a8b-uuid",
  "title": "Payment Approved",
  "body": "₹5000 received. Thank you!",
  "type": "payment",              // payment | admin | feedback_reply
  "image_base64": null,
  "read": false,
  "created_at": "..."
}
```

## Feedback
```json
{
  "id": "fb-uuid",
  "user_id": "3a8b-uuid",
  "user_name": "Asha Sharma",
  "user_email": "parent@example.com",
  "type": "suggestion",           // rating | suggestion
  "rating": null,                  // 1-5 if type=rating
  "message": "Please add Hindi medium courses",
  "admin_reply": "Coming soon in Q3",
  "admin_reply_at": "...",
  "created_at": "..."
}
```

## Wallet
```json
{
  "balance": 1250.0,
  "total_earned": 1750.0,
  "transactions": [
    { "id": "...", "amount": 500, "type": "commission", "description": "Referral - parent2", "created_at": "..." }
  ]
}
```

## Withdrawal
```json
{
  "id": "wd-uuid",
  "user_id": "3a8b-uuid",
  "amount": 500.0,
  "upi_id": "asha@okhdfc",
  "status": "pending",            // pending | approved | rejected
  "created_at": "...",
  "decided_at": null
}
```
