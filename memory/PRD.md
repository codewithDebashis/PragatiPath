# Pragati Path – PRD (v2)

## Overview
Mobile app (Expo React Native + FastAPI + MongoDB) for "Pragati Path" coaching centre. Parents register, manage **multiple children**, browse a **catalog of items** (courses, study materials, merchandise) with separate rate cards, build a **cart**, pay via **UPI QR/UPI ID**, and admin verifies the payment to enroll the child. Admin can manage advertisements, items, UPI settings, users, attendance, and the auto-message template. Parents view per-child **attendance** as a calendar.

## Roles
- **Parent** – registers, manages children, shops items, pays, reviews receipts, views child attendance.
- **Admin** – manages payments, items, ads, UPI settings, users, daily attendance, and the welcome-message template.

## Key Flows
### Parent
1. Register (parent + first child with class picker 1–10) → JWT token → parent dashboard.
2. Add more children from Profile → My Children, each with auto-generated `child_id_code` (PPC-XXXXXX).
3. Shop tab → browse items grouped by type → add to cart → Checkout modal → if course in cart, choose which child → enter UTR/upload screenshot → submit.
4. Receive notifications:
   - First child enrolled: templated "Welcome" message with parent's User ID + new password.
   - Subsequent enrollments: "Child Enrolled" info.
   - Non-course payments: "Payment Approved".
5. Tap receipt → in-app printable receipt view (`/receipt/[id]`).
6. Profile → Attendance → pick child → month calendar with present/absent/leave dots and counts.

### Admin
1. Login (default `admin@pragatipath.com / Admin@123`).
2. Dashboard with stats (pending payments, parents, children, enrolled).
3. **Items & Rate Chart** — full CRUD with type (course/material/merch/other), price, image, active toggle.
4. **Payments** — approve/reject pending; items breakdown shown.
5. **Attendance** — pick date (prev/next/today) → mark each child Present/Absent/Leave; class filter.
6. **Ads / UPI / Users / Template** — as before.

## Data Model
- `users` — parents + admin; `enrollment_status` reflects "any child enrolled" milestone.
- `children` — { id, parent_id, name, age, child_class, child_id_code, enrollment_status }.
- `items` — { id, name, description, price, item_type, image_base64, active }.
- `payments` — { id, user_id, child_id?, items[{item_id, name, price, item_type, qty, line_total}], amount, has_course, utr, screenshot_base64, status }.
- `attendance` — { id, child_id, parent_id, date(YYYY-MM-DD), status: present/absent/leave, marked_by }; unique (child_id, date) index.
- `ads`, `upi_settings`, `notifications`, `settings` (auto_message template) — as before.

## Tech
- Backend: FastAPI + Motor + bcrypt + PyJWT
- Frontend: Expo Router, AsyncStorage, axios, expo-image-picker, expo-clipboard
- Auth: Bearer JWT (mobile-adapted from playbook)
- Storage: Images stored as base64 in MongoDB

## Smart Enhancements
1. **Auto-credentials on first enrollment** — when admin approves first course payment for a parent, system generates a fresh password, hashes it, sends the templated welcome notification. Subsequent children enroll without resetting parent's working password.
2. **Server-priced cart** — payment totals are computed server-side from current item prices (never trusted from client), preventing spoofed amounts.
3. **Calendar-style attendance** — colored dots make a month's status visible at a glance for parents.
4. **Welcome message in inbox** — on register, an enrollment-typed notification with the User ID and password is dropped into the inbox so parents can always retrieve their credentials.
5. **Admin-to-parent messaging** — admin can broadcast to all parents or DM a single parent with title, body and optional image; messages show up in the parent inbox with a megaphone icon.
6. **Unread badge everywhere** — dashboard bell + Inbox tab icon both show a live red badge with the unread count (polled every 15s, refreshed on app foreground).
