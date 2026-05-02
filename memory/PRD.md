# Pragati Path – PRD

## Overview
Mobile app (Expo React Native + FastAPI + MongoDB) for "Pragati Path" coaching centre. Parents register their child, pay fees via UPI QR/UPI ID, and admin verifies payment to enroll the child. Admin can manage advertisements, UPI settings, users, and the auto-message template.

## Roles
- **Parent** – registers, pays fees, receives notifications
- **Admin** – manages payments, ads, UPI settings, users, template

## Key Flows

### Parent
1. Register (parent + child details) → JWT token → `(parent)/dashboard`
2. View announcements + child enrollment status
3. Pay fees: see UPI QR + UPI ID → pay externally → submit UTR/screenshot → status = pending
4. Wait for admin approval → receive welcome message in inbox with new User ID + password

### Admin
1. Login (default `admin@pragatipath.com` / `Admin@123`)
2. Dashboard with stats (pending, users, enrolled, ads)
3. Approve payment → child marked enrolled, new password generated, in-app message sent using template
4. Reject payment → notification sent to parent
5. Manage ads (CRUD), UPI settings, users list, auto-message template

## Auto-message Template
Editable by admin. Default:
> "Congratulations! Your ID is created. Your User ID is {user_id} and password is {password}. Pragati Path is designed for Winners and we believe each child is a winner."

## Tech
- Backend: FastAPI + Motor (MongoDB) + bcrypt + PyJWT
- Frontend: Expo Router, AsyncStorage, axios, expo-image-picker
- Auth: Bearer JWT (mobile-adapted from playbook)
- Storage: Images stored as base64 in MongoDB

## Smart Enhancement
**Auto-credentials engine**: When admin approves payment, system auto-generates a random 8-char password, hashes it, updates the parent's account, and pushes a templated welcome notification — fulfilling the "auto-message" requirement out-of-the-box and making admin work one-tap.
