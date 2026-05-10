# Backend Setup Guide

Complete step-by-step instructions to deploy the **Pragati Path** FastAPI backend on a production server with MongoDB.

> ⏱ **Time:** 30–45 minutes for a clean Ubuntu server.
> 🛠 **Skill level:** Basic Linux command-line.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Choose your MongoDB option](#2-choose-your-mongodb-option)
3. [Server preparation](#3-server-preparation)
4. [Install MongoDB (self-hosted option)](#4-install-mongodb-self-hosted-option)
5. [Use MongoDB Atlas (cloud option)](#5-use-mongodb-atlas-cloud-option)
6. [Get the code](#6-get-the-code)
7. [Python virtual environment & dependencies](#7-python-virtual-environment--dependencies)
8. [Environment variables (`.env`)](#8-environment-variables-env)
9. [Run the backend (development)](#9-run-the-backend-development)
10. [Run with Supervisor (production)](#10-run-with-supervisor-production)
11. [Nginx reverse proxy](#11-nginx-reverse-proxy)
12. [HTTPS with Let's Encrypt](#12-https-with-lets-encrypt)
13. [Verify it works](#13-verify-it-works)
14. [Default admin & first login](#14-default-admin--first-login)
15. [Backups & monitoring](#15-backups--monitoring)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Prerequisites

### Hardware (minimum)

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Disk | 10 GB SSD | 25 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

> Tested on Ubuntu 22.04 / 24.04 and Debian 12. Other distros work — adapt the package commands.

### A domain name (optional but recommended)
Point an `A` record to your server's IP, e.g. `api.pragatipath.com → 1.2.3.4`. You'll need it for HTTPS.

### Open ports

| Port | Purpose |
|---|---|
| 22 | SSH |
| 80 | HTTP (Let's Encrypt + Nginx) |
| 443 | HTTPS |
| 8001 | (internal only — backend bind) |
| 27017 | (internal only — MongoDB if self-hosted) |

---

## 2. Choose your MongoDB option

| Option | Pros | Cons | When to pick |
|---|---|---|---|
| **A. Self-hosted MongoDB** on the same server | Free, full control | You manage backups, upgrades, security | Small deployments, dev/staging |
| **B. MongoDB Atlas** (cloud) | Managed, free tier (M0 = 512 MB), automated backups | Limit on free tier, internet dependency | Production, anything serious |

Pick one and follow either §4 or §5.

---

## 3. Server preparation

SSH into the server as root or a sudoer:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y software-properties-common curl git ufw build-essential
```

Configure firewall:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # opens 80 + 443
sudo ufw enable
sudo ufw status
```

Create a non-root user (skip if already done):
```bash
sudo adduser pragati
sudo usermod -aG sudo pragati
sudo su - pragati   # switch to that user
```

---

## 4. Install MongoDB (self-hosted option)

Pick this OR §5 — not both.

```bash
# Import MongoDB 7.0 GPG key
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

# Add repository (Ubuntu 22.04 jammy; for 24.04 use noble)
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list

sudo apt update
sudo apt install -y mongodb-org

# Start & enable on boot
sudo systemctl enable --now mongod
sudo systemctl status mongod   # should show "active (running)"
```

### Secure with auth (recommended)

```bash
mongosh
```
Inside the mongo shell:
```javascript
use admin
db.createUser({
  user: "pragatiAdmin",
  pwd:  "CHANGE_THIS_STRONG_PASSWORD",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" }, "readWriteAnyDatabase" ]
})
exit
```

Enable auth in `/etc/mongod.conf`:
```bash
sudo nano /etc/mongod.conf
```
Find/add:
```yaml
security:
  authorization: enabled
net:
  port: 27017
  bindIp: 127.0.0.1   # only the server itself can connect
```
Restart:
```bash
sudo systemctl restart mongod
```

Your **MONGO_URL** for the backend will be:
```
mongodb://pragatiAdmin:CHANGE_THIS_STRONG_PASSWORD@127.0.0.1:27017/?authSource=admin
```

Skip to §6.

---

## 5. Use MongoDB Atlas (cloud option)

Pick this OR §4.

1. Go to https://cloud.mongodb.com → sign up (free).
2. **Build a Database** → choose **Free M0 cluster** → pick a region near your server.
3. **Database Access** → Add database user (e.g. `pragati_user` + strong password).
4. **Network Access** → Add IP address → enter your server's public IP. (For dev: use `0.0.0.0/0` to allow everywhere — change later for production.)
5. **Database** → Connect → **Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://pragati_user:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<password>` with the actual one.

That's your **MONGO_URL**. Continue to §6.

---

## 6. Get the code

Clone the repo (assumes you've pushed to GitHub):
```bash
cd /opt
sudo mkdir pragati-path
sudo chown $USER:$USER pragati-path
cd pragati-path
git clone https://github.com/<your-username>/pragati-path.git .
```

Or upload the project ZIP:
```bash
scp pragati-path.zip pragati@your-server:/opt/pragati-path/
ssh pragati@your-server
cd /opt/pragati-path && unzip pragati-path.zip
```

You should now have `/opt/pragati-path/backend/server.py` etc.

---

## 7. Python virtual environment & dependencies

```bash
sudo apt install -y python3.11 python3.11-venv python3-pip

cd /opt/pragati-path/backend
python3.11 -m venv venv
source venv/bin/activate

pip install --upgrade pip
pip install -r requirements.txt
```

Verify:
```bash
python -c "import fastapi, motor, jwt, bcrypt, scalar_fastapi; print('all good')"
```

---

## 8. Environment variables (`.env`)

Create `/opt/pragati-path/backend/.env`:
```bash
nano /opt/pragati-path/backend/.env
```
Paste (replace placeholders):
```env
# MongoDB connection (from §4 or §5)
MONGO_URL="mongodb+srv://pragati_user:YOUR_PASSWORD@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority"
DB_NAME="pragati_path"

# JWT — generate a strong secret (different from default!)
JWT_SECRET="REPLACE_WITH_64_CHAR_RANDOM_STRING"

# Optional: only set if you want a non-default admin
SEED_ADMIN_EMAIL="admin@yourdomain.com"
SEED_ADMIN_PASSWORD="ChangeMe@Strong#2025"
```

Generate a strong JWT secret:
```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"
```
Copy the output into `JWT_SECRET`.

Lock down the file:
```bash
chmod 600 /opt/pragati-path/backend/.env
```

> ⚠️ **Never commit `.env` to git.** It's already in `.gitignore`.

---

## 9. Run the backend (development)

Quick test before going production:
```bash
cd /opt/pragati-path/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

In another terminal:
```bash
curl http://localhost:8001/api/
# {"message":"Pragati Path API","ok":true}

curl http://localhost:8001/api/openapi.json | head -c 200
# Should print spec JSON
```

If both work — **MongoDB is connected and the backend is happy.** Stop with `Ctrl+C` and continue.

---

## 10. Run with Supervisor (production)

Supervisor keeps the backend alive after reboots and crashes.

```bash
sudo apt install -y supervisor
```

Create `/etc/supervisor/conf.d/pragati-backend.conf`:
```ini
[program:pragati-backend]
command=/opt/pragati-path/backend/venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --workers 2
directory=/opt/pragati-path/backend
user=pragati
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=10
stdout_logfile=/var/log/supervisor/pragati-backend.out.log
stderr_logfile=/var/log/supervisor/pragati-backend.err.log
environment=PATH="/opt/pragati-path/backend/venv/bin:%(ENV_PATH)s"
```

Apply:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status pragati-backend
# pragati-backend          RUNNING   pid 12345, uptime 0:00:05
```

Logs:
```bash
sudo tail -f /var/log/supervisor/pragati-backend.err.log
```

Stop / start / restart:
```bash
sudo supervisorctl restart pragati-backend
```

> **Workers tuning:** rule of thumb is `(2 × CPU cores) + 1`. Edit `--workers 2` accordingly.

---

## 11. Nginx reverse proxy

Nginx terminates TLS, serves on port 80/443, and forwards `/api/*` to the backend on `localhost:8001`.

```bash
sudo apt install -y nginx
```

Create `/etc/nginx/sites-available/pragati-api`:
```nginx
server {
    listen 80;
    server_name api.pragatipath.com;   # ← replace with your domain

    # Allow up to 10 MB request bodies (UPI screenshots are base64)
    client_max_body_size 10M;

    location / {
        proxy_pass         http://127.0.0.1:8001;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Enable & reload:
```bash
sudo ln -s /etc/nginx/sites-available/pragati-api /etc/nginx/sites-enabled/
sudo nginx -t   # syntax test
sudo systemctl reload nginx
```

Test:
```bash
curl http://api.pragatipath.com/api/
```

---

## 12. HTTPS with Let's Encrypt

Free, automatic SSL certificates:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.pragatipath.com
```

Follow the prompts (enter email, agree to ToS, choose redirect-HTTP-to-HTTPS = yes).

Certbot edits the Nginx config to add SSL. Verify:
```bash
curl https://api.pragatipath.com/api/
```

Auto-renewal is set up via systemd timer. Test it:
```bash
sudo certbot renew --dry-run
```

---

## 13. Verify it works

Open in browser:

| URL | Expected |
|---|---|
| `https://api.pragatipath.com/api/` | `{"message":"Pragati Path API","ok":true}` |
| `https://api.pragatipath.com/api/docs` | Beautiful landing page with 4 doc options |
| `https://api.pragatipath.com/api/docs/scalar` | Modern Scalar reference UI |
| `https://api.pragatipath.com/api/docs/swagger` | Classic Swagger UI |
| `https://api.pragatipath.com/api/openapi.json` | OpenAPI 3.1 JSON spec |

Run the integration smoke-test:
```bash
curl -X POST https://api.pragatipath.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@pragatipath.com","password":"Admin@123"}'
```
Should return a `token` field. ✅

---

## 14. Default admin & first login

On first startup, the backend seeds an admin account. Default (defined in `server.py`):
```
email:    admin@pragatipath.com
password: Admin@123
```

> Override these by setting `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env` BEFORE the first run.

**Critical first action:** log into the admin panel via your mobile app or use the API to change the admin password:
```bash
curl -X POST https://api.pragatipath.com/api/admin/users/<admin-user-id>/reset-password \
  -H "Authorization: Bearer <admin-token>" \
  -H 'Content-Type: application/json' \
  -d '{"new_password":"YourNewStrong@Password!2025"}'
```

The backend also auto-creates the following:
- Default UPI settings (empty — admin to fill via UI)
- Default ad banner (placeholder)
- Default seed items (Foundation Course, Study Material Pack, etc.) — only if collection is empty

---

## 15. Backups & monitoring

### MongoDB backups (Atlas)
Atlas takes automated daily snapshots on M10+. On the free M0 tier, manually export:
```bash
mongodump --uri="$MONGO_URL" --out=/backup/$(date +%F)
```
Schedule via cron:
```bash
crontab -e
# Add:
0 2 * * * /usr/bin/mongodump --uri="mongodb+srv://..." --out=/backup/$(date +\%F) --quiet
```

### Self-hosted MongoDB backups
```bash
# Daily 2 AM dump, 7-day retention
0 2 * * * mongodump --uri="mongodb://user:pass@127.0.0.1:27017/?authSource=admin" --out=/backup/$(date +\%F) && find /backup -mtime +7 -exec rm -rf {} +
```

### Backend monitoring
- **Logs:** `/var/log/supervisor/pragati-backend.err.log` (uvicorn output)
- **Health check:** `curl https://api.pragatipath.com/api/` should always return 200
- **Add to UptimeRobot / BetterUptime:** they ping the URL every 5 min and alert on failure

### Performance metrics (optional)
```bash
sudo apt install -y htop
htop
```
Or set up Grafana + Prometheus for graphs.

---

## 16. Troubleshooting

### Backend won't start

```bash
sudo supervisorctl tail -f pragati-backend stderr
```

Common causes:

| Error | Fix |
|---|---|
| `pymongo.errors.ServerSelectionTimeoutError` | Wrong `MONGO_URL` or MongoDB is down. `sudo systemctl status mongod` or check Atlas IP whitelist. |
| `KeyError: 'JWT_SECRET'` | `.env` not loaded. Confirm file at `/opt/pragati-path/backend/.env` and supervisor `directory=` is correct. |
| `ModuleNotFoundError: No module named 'fastapi'` | venv not activated in supervisor. Ensure `command=/opt/pragati-path/backend/venv/bin/uvicorn ...` (full path). |
| `[Errno 98] Address already in use` | Port 8001 occupied. `sudo lsof -i :8001` and kill the process, then restart. |

### 502 Bad Gateway on Nginx
Backend is down → check supervisor.
```bash
sudo supervisorctl status
sudo supervisorctl restart pragati-backend
```

### CORS errors from the mobile app
Already wide-open (`*`) by default. If you tightened it, add your domain to the `allow_origins` list in `server.py`.

### Mongo "Authentication failed"
- Wrong username/password in `MONGO_URL`
- Special characters in password not URL-encoded — use `urllib.parse.quote_plus("p@ss")` and use the encoded form in the URL
- For Atlas: ensure user has the right database access role (Read & Write to any database)

### Push notifications not arriving
- Push tokens are only registered on **real devices** (not web preview / simulators)
- Backend logs `Expo push failed: ...` on bad tokens — these are silent and don't break anything
- Verify token: `db.users.find({}, {push_token: 1})` in mongosh

---

## 🎉 You're done

Your backend is now:
- ✅ Live at `https://api.pragatipath.com/api/`
- ✅ TLS-secured
- ✅ Auto-restarting via supervisor
- ✅ Monitored via standard logs
- ✅ Backed up daily

**Next steps:**
1. Update `EXPO_PUBLIC_BACKEND_URL` in your Expo app's `.env` to your new domain
2. Rebuild the Android APK ([HOW_TO_BUILD_APK.md](../HOW_TO_BUILD_APK.md))
3. Distribute the APK to parents/staff

For API usage: read [`getting-started.md`](./getting-started.md) and explore the live Scalar UI at `https://api.pragatipath.com/api/docs/scalar`.
