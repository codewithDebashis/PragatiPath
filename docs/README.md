# Pragati Path API Documentation

Welcome! This folder contains the complete API documentation for the **Pragati Path** coaching-centre management platform.

> **Live, interactive docs** are also served by the backend at:
> - 🚀 **`/api/docs/scalar`** — modern Scalar reference with "Try it" client
> - 📑 **`/api/docs/swagger`** — classic Swagger UI
> - 📘 **`/api/docs/redoc`** — three-panel ReDoc
> - 📦 **`/api/openapi.json`** — raw OpenAPI 3.1 spec

## Files in this folder

| File | Purpose |
|---|---|
| **[`getting-started.md`](./getting-started.md)** | Step-by-step quickstart: register → login → call protected endpoint |
| **[`authentication.md`](./authentication.md)** | JWT bearer auth, roles, token lifecycle |
| **[`endpoints.md`](./endpoints.md)** | All endpoints grouped by feature with curl examples |
| **[`models.md`](./models.md)** | Request/response data models |
| **[`errors.md`](./errors.md)** | Error format & common HTTP codes |
| **[`scalar.html`](./scalar.html)** | **Standalone Scalar preview** (open in browser, no server needed) |
| **[`openapi.json`](./openapi.json)** | Auto-generated OpenAPI 3.1 specification |

## Tech stack
- **API** — FastAPI (Python 3.11)
- **DB** — MongoDB via Motor (async)
- **Auth** — JWT (HS256, 30-day expiry) with bcrypt password hashing
- **Spec** — OpenAPI 3.1, exposed via FastAPI auto-generation
- **Reference UI** — [Scalar](https://scalar.com/) for the modern viewer

## Quick links
- 📖 [Getting started](./getting-started.md) — first API call in 2 minutes
- 🔑 [Authentication](./authentication.md) — bearer tokens, roles
- 📡 [Endpoint catalogue](./endpoints.md) — 47 endpoints across 13 tags
- 🔍 [Open Scalar locally](./scalar.html) — drag-and-drop into your browser

## Stats
- **47** REST endpoints
- **13** feature tags (Auth, Children, Shop, Payments, Attendance, etc.)
- **2** roles (parent / admin)
- **OpenAPI 3.1** compliant — works with Postman, Insomnia, Bruno, RapidAPI, Stoplight, etc.
