# iF Fleet — Production Server Deployment Guide

**Target:** `fleet.ideaforgetech.com` — single-server production deployment using Docker Compose, Nginx, PostgreSQL, and Let's Encrypt TLS.

This guide covers everything from a bare server to a running production system. It is designed for a **lift-and-shift** approach — the app directory already exists on the server and you need to get it running correctly with Docker.

---

## Table of Contents

- [Server Requirements](#server-requirements)
- [Part 1 — Prepare the Server](#part-1--prepare-the-server)
  - [1.1 Install Docker](#11-install-docker)
  - [1.2 Get the App Onto the Server](#12-get-the-app-onto-the-server)
  - [1.3 Initialise Git (if missing)](#13-initialise-git-if-missing)
  - [1.4 Verify the Directory Structure](#14-verify-the-directory-structure)
- [Part 2 — Configure the Environment](#part-2--configure-the-environment)
  - [2.1 Create the Production Env File](#21-create-the-production-env-file)
  - [2.2 Critical Variables Explained](#22-critical-variables-explained)
  - [2.3 Generate Secrets](#23-generate-secrets)
- [Part 3 — Obtain a TLS Certificate](#part-3--obtain-a-tls-certificate)
- [Part 4 — Build and Deploy](#part-4--build-and-deploy)
  - [4.1 First Deploy (includes DB seed)](#41-first-deploy-includes-db-seed)
  - [4.2 Verify the Deployment](#42-verify-the-deployment)
  - [4.3 Default Seed Accounts](#43-default-seed-accounts)
- [Part 5 — Day-to-Day Operations](#part-5--day-to-day-operations)
  - [View Logs](#view-logs)
  - [Service Status](#service-status)
  - [Restart a Service](#restart-a-service)
  - [Database Backup](#database-backup)
  - [TLS Certificate Renewal](#tls-certificate-renewal)
- [Part 6 — Updating to a New Release](#part-6--updating-to-a-new-release)
  - [6.1 Via Git Pull (recommended)](#61-via-git-pull-recommended)
  - [6.2 Via Manual File Copy (lift-and-shift)](#62-via-manual-file-copy-lift-and-shift)
- [Troubleshooting](#troubleshooting)
  - [fatal: not a git repository](#fatal-not-a-git-repository)
  - [Can't reach database server at localhost:5432](#cant-reach-database-server-at-localhost5432)
  - [prisma generate / nest build fails in Docker](#prisma-generate--nest-build-fails-in-docker)
  - [Container exits immediately after start](#container-exits-immediately-after-start)
  - [nginx: SSL certificate not found](#nginx-ssl-certificate-not-found)
  - [API health returns 503 or times out](#api-health-returns-503-or-times-out)
  - [OTP emails not arriving](#otp-emails-not-arriving)
- [Architecture Quick-Reference](#architecture-quick-reference)

---

## Server Requirements

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| **OS** | Ubuntu 22.04 LTS | Also tested on Debian 12. CentOS/RHEL needs adjusted package commands. |
| **RAM** | 2 GB | 4 GB recommended — Docker build uses ~1.5 GB peak |
| **Disk** | 20 GB free | Docker images + database volumes + log retention |
| **CPU** | 2 vCPUs | Build step is CPU-intensive; 4+ vCPUs cuts build time significantly |
| **Ports** | 80 + 443 open | Inbound TCP from the internet — required for TLS and serving |
| **DNS** | `fleet.ideaforgetech.com` → server IP | Must resolve before running certbot |
| **Docker** | Engine ≥ 24 + Compose v2 | Installed in Part 1 |

> **Not required on the server:** Node.js, pnpm, Git (the build happens inside Docker). You only need Docker.

---

## Part 1 — Prepare the Server

### 1.1 Install Docker

```bash
# Remove any old Docker packages
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# Install Docker Engine and Compose plugin
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (so you don't need sudo for docker commands)
sudo usermod -aG docker $USER

# Apply group change without logging out
newgrp docker

# Verify
docker --version          # Docker version 24.x.x or higher
docker compose version    # Docker Compose version v2.x.x
```

> If `curl -fsSL https://get.docker.com` is blocked on your network, follow the [official Docker Engine install guide for Ubuntu](https://docs.docker.com/engine/install/ubuntu/).

---

### 1.2 Get the App Onto the Server

Choose **one** of the following methods depending on your setup:

#### Option A — Git Clone (Recommended going forward)

If the repository is accessible from the server:

```bash
# Clone to /opt/if-fleet (requires git on the server)
sudo apt-get install -y git
sudo mkdir -p /opt/if-fleet
sudo chown $USER:$USER /opt/if-fleet

git clone https://github.com/if-marutidivekar/iF-Fleet-App.git /opt/if-fleet
cd /opt/if-fleet

# Switch to the branch you want to deploy
git checkout fix/docker-compose-deps-lockfile
# Or: git checkout main (when merged)
```

#### Option B — rsync from Your Local Machine (Lift-and-shift)

Run this from your **local Windows machine** (in Git Bash, WSL, or PowerShell with OpenSSH):

```bash
# From your local machine — sync the project directory to the server
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  "D:/iF_Data/Projects/Fleet Management App/iF_Fleet_App/" \
  user@<server-ip>:/opt/if-fleet/

# Then SSH into the server
ssh user@<server-ip>
cd /opt/if-fleet
```

#### Option C — SCP a ZIP Archive

```bash
# On local machine: create archive (exclude node_modules and build artifacts)
cd "D:/iF_Data/Projects/Fleet Management App"
zip -r iF_Fleet_App.zip iF_Fleet_App/ \
  --exclude "*/node_modules/*" --exclude "*/.git/*" --exclude "*/dist/*"

# Upload to server
scp iF_Fleet_App.zip user@<server-ip>:/opt/

# On server: extract
ssh user@<server-ip>
cd /opt
unzip iF_Fleet_App.zip
mv iF_Fleet_App if-fleet
cd if-fleet
```

---

### 1.3 Initialise Git (if missing)

If you used Option B or C above and see this error when trying to run git commands:

```
fatal: not a git repository (or any of the parent directories): .git
```

You have two choices:

**Choice 1: Don't use git on the server** (perfectly valid for lift-and-shift)  
The deploy script and Docker Compose do not require git. You can ignore this error and proceed with the rsync/SCP workflow for future updates. Skip to [Part 2](#part-2--configure-the-environment).

**Choice 2: Initialise git so you can use `git pull` for future updates**

```bash
cd /opt/if-fleet

# Initialise a local repo
git init

# Add GitHub as the remote
git remote add origin https://github.com/if-marutidivekar/iF-Fleet-App.git

# Fetch all branches from GitHub
git fetch origin

# Switch to your target branch
git checkout -b fix/docker-compose-deps-lockfile origin/fix/docker-compose-deps-lockfile
# Or: git checkout -b main origin/main (when merged)
```

From this point you can use `git pull origin <branch>` for future updates.

---

### 1.4 Verify the Directory Structure

Before continuing, confirm these key files exist on the server:

```bash
cd /opt/if-fleet   # or wherever you extracted the project

ls infra/docker/
# Expected output includes:
#   Dockerfile.api  Dockerfile.web  Dockerfile.worker
#   docker-compose.prod.yml  docker-compose.staging.yml
#   .env.prod.template  nginx/

ls infra/scripts/
# Expected: deploy.sh  backup.sh  smoke-test.sh

ls apps/api/
# Expected: src/  prisma/  package.json  tsconfig.json  nest-cli.json
```

If `nest-cli.json` is missing from `apps/api/`, the Docker build will fail. It must exist — it was added in the latest commit on `fix/docker-compose-deps-lockfile`.

---

## Part 2 — Configure the Environment

### 2.1 Create the Production Env File

```bash
cd /opt/if-fleet

cp infra/docker/.env.prod.template infra/docker/.env.prod
nano infra/docker/.env.prod   # or vim, or your preferred editor
```

Fill in **every** value in the file. Do not leave any `CHANGE_ME` placeholders — the deploy script will warn you if it detects them.

### 2.2 Critical Variables Explained

| Variable | What to Set | Why |
|----------|-------------|-----|
| `POSTGRES_PASSWORD` | A strong random password (≥ 20 chars) | Secures the database |
| `DATABASE_URL` | `postgresql://fleet_user:<PASSWORD>@postgres:5432/fleet_db` | **Must use `postgres` (service name) — not `localhost`** |
| `REDIS_URL` | `redis://redis:6379` | **Must use `redis` (service name) — not `localhost`** |
| `JWT_SECRET` | 64-char random hex string | Signs authentication tokens |
| `PIN_HMAC_SECRET` | 32-char random hex string | Driver PIN uniqueness hash |
| `COMPANY_EMAIL_DOMAIN` | `ideaforgetech.com` | Only this domain can log in via OTP |
| `CORS_ORIGINS` | `https://fleet.ideaforgetech.com` | Restricts cross-origin API access |
| `SMTP_*` | Your company SMTP credentials | Delivers OTP emails to Employees/Admins |

> **The most common deployment error:** Setting `DATABASE_URL=postgresql://...@localhost:5432/...` instead of `@postgres:5432`. Inside Docker, `localhost` refers to the container itself — the database container is only reachable by its service name (`postgres`).

### 2.3 Generate Secrets

Run these on the server (Node.js not required — uses openssl):

```bash
# JWT_SECRET (64-char hex)
openssl rand -hex 64

# PIN_HMAC_SECRET (32-char hex)
openssl rand -hex 32

# POSTGRES_PASSWORD (strong random password)
openssl rand -base64 32 | tr -d '/+=' | head -c 30
```

Paste each output value into the corresponding variable in `infra/docker/.env.prod`.

**Example `.env.prod` (with real secrets filled in):**

```env
POSTGRES_DB=fleet_db
POSTGRES_USER=fleet_user
POSTGRES_PASSWORD=Xk7mP2nQvLcRsY9bWdTa

DATABASE_URL=postgresql://fleet_user:Xk7mP2nQvLcRsY9bWdTa@postgres:5432/fleet_db
REDIS_URL=redis://redis:6379

NODE_ENV=production
PORT=3001
CORS_ORIGINS=https://fleet.ideaforgetech.com

JWT_SECRET=a4e9b1c2d3f4...  # (64 hex chars)
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
COMPANY_EMAIL_DOMAIN=ideaforgetech.com

PIN_HMAC_SECRET=7f8c9d2e...  # (32 hex chars)

SMTP_HOST=smtp.ideaforgetech.com
SMTP_PORT=587
SMTP_USER=fleet-noreply@ideaforgetech.com
SMTP_PASS=your-smtp-password
SMTP_FROM="iF Fleet <fleet-noreply@ideaforgetech.com>"

FCM_SERVER_KEY=your-fcm-key
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apple-team-id

MAPBOX_ACCESS_TOKEN=pk.eyJ1...

GRAFANA_ADMIN_PASSWORD=SecureGrafanaPass123
```

---

## Part 3 — Obtain a TLS Certificate

The production nginx config expects Let's Encrypt certificates at:

```
/etc/letsencrypt/live/fleet.ideaforgetech.com/fullchain.pem
/etc/letsencrypt/live/fleet.ideaforgetech.com/privkey.pem
/etc/letsencrypt/live/fleet.ideaforgetech.com/chain.pem
```

Before obtaining a certificate, confirm DNS is resolving:

```bash
# From any machine (or the server itself)
curl -s https://dns.google/resolve?name=fleet.ideaforgetech.com | python3 -m json.tool
# or
nslookup fleet.ideaforgetech.com
```

The A record must point to this server's public IP. Let's Encrypt will fail if DNS isn't ready.

**Obtain the certificate using the deploy script's `--obtain-cert` flag:**

```bash
cd /opt/if-fleet
bash infra/scripts/deploy.sh --obtain-cert
```

This runs `certbot` in a Docker container (no certbot installation required) using the standalone challenge on port 80. It will:
1. Stop any running nginx (port 80 must be free)
2. Bind port 80 and serve the ACME challenge
3. Download and store the certificate to `/etc/letsencrypt/`

If you prefer to run certbot directly:

```bash
# Install certbot
sudo apt-get install -y certbot

# Ensure port 80 is free (stop any existing nginx)
sudo docker compose -f /opt/if-fleet/infra/docker/docker-compose.prod.yml stop nginx 2>/dev/null || true

# Obtain certificate
sudo certbot certonly --standalone \
  -d fleet.ideaforgetech.com \
  --non-interactive \
  --agree-tos \
  --email admin@ideaforgetech.com

# Verify
ls /etc/letsencrypt/live/fleet.ideaforgetech.com/
# fullchain.pem  privkey.pem  chain.pem  cert.pem
```

---

## Part 4 — Build and Deploy

### 4.1 First Deploy (includes DB seed)

The `deploy.sh` script handles the full deployment: builds Docker images, starts all services, waits for health checks, and optionally seeds the database.

```bash
cd /opt/if-fleet

# Full first deploy: build images + seed database
bash infra/scripts/deploy.sh --seed
```

**What this does, in order:**

1. Verifies `.env.prod` exists and has no `CHANGE_ME` placeholders
2. Builds the `api` and `web-app` Docker images from source (this takes 3–8 minutes on first run)
3. Starts `postgres` and `redis` containers
4. Waits for PostgreSQL to be healthy
5. Runs the database seed (creates default accounts, vehicles, preset locations)
6. Starts all remaining services (`nginx`, `api`, `web-app`)
7. Waits for the API health endpoint to return `200`
8. Prints the live URL

> The Docker build compiles the full TypeScript codebase inside the container — no Node.js or pnpm installation is needed on the server.

**If the TLS certificate was not yet obtained, run:**

```bash
bash infra/scripts/deploy.sh --obtain-cert --seed
```

---

### 4.2 Verify the Deployment

After the script completes, run these checks manually:

```bash
# 1. All containers should be running
docker compose -f /opt/if-fleet/infra/docker/docker-compose.prod.yml ps

# 2. API health check (should return 200 with db + redis status)
curl -s https://fleet.ideaforgetech.com/api/v1/health | python3 -m json.tool

# 3. Web app reachable
curl -I https://fleet.ideaforgetech.com
# Expected: HTTP/2 200

# 4. Automated smoke tests (auth, protected endpoints)
bash /opt/if-fleet/infra/scripts/smoke-test.sh https://fleet.ideaforgetech.com/api/v1
```

Expected API health response:
```json
{
  "status": "ok",
  "database": "ok",
  "redis": "ok"
}
```

**Post-deployment checklist:**

- [ ] `https://fleet.ideaforgetech.com` loads the iF Fleet login page
- [ ] API health endpoint returns `ok` for database and redis
- [ ] Smoke tests pass (all checks green)
- [ ] Admin can log in via OTP (`admin@ideaforgetech.com`)
- [ ] Admin → Settings: configure SMTP if not done via env
- [ ] Admin creates real user accounts and deletes demo seed accounts
- [ ] TLS certificate shows as valid in the browser (padlock icon)

---

### 4.3 Default Seed Accounts

The seed creates these demo accounts for initial testing. **Remove or disable them after go-live.**

| Role | Email | Login Method | Note |
|------|-------|-------------|------|
| **Admin** | `admin@ideaforgetech.com` | Email OTP (web or mobile) | Full admin access |
| **Employee** | `employee@ideaforgetech.com` | Email OTP (web or mobile) | Demo employee |
| **Driver** | `driver@ideaforgetech.com` | Mobile PIN (mobile app only) | Initial PIN set in seed script |

> The driver's initial PIN is set in `infra/scripts/seed.ts`. After the driver logs in for the first time, they will be forced to change it.

The seed also creates:
- 3 sample vehicles (Sedan `MH-01-AA-1234`, SUV `MH-01-BB-5678`, Van `MH-01-CC-9012`)
- 4 preset locations (Head Office, Warehouse B, Site Alpha, Airport Terminal 2)
- App config with `booking.approvalMode = MANUAL`

---

## Part 5 — Day-to-Day Operations

All commands below assume you are SSHed into the server and in `/opt/if-fleet`.

### View Logs

```bash
# All services (live tail)
docker compose -f infra/docker/docker-compose.prod.yml logs -f

# API only
docker compose -f infra/docker/docker-compose.prod.yml logs -f api

# Last 200 lines, then follow
docker compose -f infra/docker/docker-compose.prod.yml logs --tail=200 -f api

# Filter for errors only
docker compose -f infra/docker/docker-compose.prod.yml logs api | grep -i error
```

### Service Status

```bash
docker compose -f infra/docker/docker-compose.prod.yml ps
```

Expected healthy state:

```
NAME                        STATUS
if-fleet-nginx-1            Up (healthy)
if-fleet-web-app-1          Up (healthy)
if-fleet-api-1              Up (healthy)
if-fleet-postgres-1         Up (healthy)
if-fleet-redis-1            Up (healthy)
```

### Restart a Service

```bash
# Restart the API (e.g., after an env change)
docker compose -f infra/docker/docker-compose.prod.yml restart api

# Restart nginx (e.g., after cert renewal)
docker compose -f infra/docker/docker-compose.prod.yml restart nginx

# Restart everything
docker compose -f infra/docker/docker-compose.prod.yml restart
```

### Database Backup

The `backup.sh` script creates a timestamped SQL dump and retains the last 7:

```bash
bash /opt/if-fleet/infra/scripts/backup.sh /opt/backups
# Creates: /opt/backups/fleet_db_YYYYMMDD_HHMMSS.sql.gz
```

Schedule daily backups with cron:

```bash
# Edit crontab
crontab -e

# Add this line (runs every day at 2:00 AM):
0 2 * * * bash /opt/if-fleet/infra/scripts/backup.sh /opt/backups >> /var/log/if-fleet-backup.log 2>&1
```

### TLS Certificate Renewal

Let's Encrypt certificates expire after 90 days. Renew them with:

```bash
# Renew (certbot will skip if cert is not due yet)
docker run --rm \
  -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot renew --standalone

# Restart nginx to pick up the new cert
docker compose -f /opt/if-fleet/infra/docker/docker-compose.prod.yml restart nginx
```

Automate with a monthly cron:

```bash
crontab -e

# Add (runs on the 1st of each month at 3:00 AM):
0 3 1 * * docker run --rm -p 80:80 \
  -v /etc/letsencrypt:/etc/letsencrypt \
  -v /var/www/certbot:/var/www/certbot \
  certbot/certbot renew --standalone --quiet && \
  docker compose -f /opt/if-fleet/infra/docker/docker-compose.prod.yml restart nginx \
  >> /var/log/if-fleet-certbot.log 2>&1
```

---

## Part 6 — Updating to a New Release

Always take a database backup before updating.

### 6.1 Via Git Pull (recommended)

If you initialised git on the server (see [Part 1.3](#13-initialise-git-if-missing)):

```bash
cd /opt/if-fleet

# Take a backup first
bash infra/scripts/backup.sh /opt/backups

# Pull latest code
git pull origin fix/docker-compose-deps-lockfile
# Or: git pull origin main (after branch is merged)

# Rebuild images and redeploy (no seed on updates)
bash infra/scripts/deploy.sh
```

### 6.2 Via Manual File Copy (lift-and-shift)

From your **local Windows machine**:

```bash
# Sync changes to the server (exclude node_modules, dist, .git)
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude 'dist' \
  "D:/iF_Data/Projects/Fleet Management App/iF_Fleet_App/" \
  user@<server-ip>:/opt/if-fleet/
```

Then on the **server**:

```bash
cd /opt/if-fleet

# Take a backup
bash infra/scripts/backup.sh /opt/backups

# Rebuild images and redeploy
bash infra/scripts/deploy.sh
```

> `deploy.sh` without `--seed` rebuilds the images and restarts all services. It does **not** re-seed the database. Migrations are applied automatically by the API container's startup CMD (`prisma migrate deploy`).

---

## Troubleshooting

### `fatal: not a git repository`

**Cause:** The app was uploaded to the server without initialising a git repository (lift-and-shift). Docker Compose and the deploy script do not require git — this error is safe to ignore if you are using rsync/SCP for deployments.

**Fix (to enable `git pull` in future):**
```bash
cd /opt/if-fleet
git init
git remote add origin https://github.com/if-marutidivekar/iF-Fleet-App.git
git fetch origin
git checkout -b fix/docker-compose-deps-lockfile origin/fix/docker-compose-deps-lockfile
```

---

### `Can't reach database server at localhost:5432`

**Cause:** `DATABASE_URL` in `infra/docker/.env.prod` uses `localhost` instead of the Docker service name `postgres`.

Inside Docker, `localhost` resolves to the container itself — not the database container. Containers communicate by service name.

**Fix:** Open `infra/docker/.env.prod` and change:

```bash
# WRONG — localhost refers to the API container itself
DATABASE_URL=postgresql://fleet_user:password@localhost:5432/fleet_db

# CORRECT — 'postgres' is the Docker service name in docker-compose.prod.yml
DATABASE_URL=postgresql://fleet_user:password@postgres:5432/fleet_db
```

Then restart the API:
```bash
docker compose -f infra/docker/docker-compose.prod.yml restart api
```

The same rule applies to `REDIS_URL` — use `redis://redis:6379`, not `redis://localhost:6379`.

---

### `prisma generate` / `nest build` fails in Docker

**Cause:** Build order issue — the old `Dockerfile.api` ran `nest build` before `prisma generate`, so TypeScript could not find `@prisma/client` types. This has been fixed in the current `Dockerfile.api`.

**Verify you have the latest Dockerfile:**
```bash
head -20 infra/docker/Dockerfile.api
# Should show a comment block explaining single-stage build and build order
```

If the file is outdated, re-sync from the repo and rebuild:
```bash
docker compose -f infra/docker/docker-compose.prod.yml build --no-cache api
```

---

### Container exits immediately after start

**Diagnose:**
```bash
# Check exit code and last log lines
docker compose -f infra/docker/docker-compose.prod.yml ps
docker compose -f infra/docker/docker-compose.prod.yml logs --tail=50 api
```

**Common causes:**

| Log message | Fix |
|-------------|-----|
| `Can't reach database server at localhost:5432` | Fix `DATABASE_URL` — use service name `postgres`, not `localhost` |
| `Error: P1001` | PostgreSQL container is not healthy yet — wait and retry, or check `docker compose logs postgres` |
| `Environment variable not found: JWT_SECRET` | A required variable is missing from `.env.prod` |
| `Nest: unable to read configuration file` | `nest-cli.json` is missing from `apps/api/` — sync the latest code |
| `Cannot find module '@prisma/client'` | Prisma generate failed during build — rebuild with `--no-cache` |

---

### nginx: SSL certificate not found

**Symptom:** nginx container starts but immediately exits, or returns `502 Bad Gateway` on HTTPS.

**Cause:** The certificate files don't exist at `/etc/letsencrypt/live/fleet.ideaforgetech.com/`.

**Fix:**
```bash
# Confirm cert files exist on the server host
ls /etc/letsencrypt/live/fleet.ideaforgetech.com/
# fullchain.pem  privkey.pem  chain.pem  cert.pem  README

# If missing, obtain the certificate first (see Part 3)
bash /opt/if-fleet/infra/scripts/deploy.sh --obtain-cert
```

**Temporary workaround (HTTP only, no HTTPS):** Edit `infra/docker/nginx/nginx.prod.conf` to remove the HTTPS server block and serve on port 80 only. This is for diagnosis only — do not run production without TLS.

---

### API health returns 503 or times out

**Diagnose step by step:**

```bash
# 1. Is the API container running?
docker compose -f infra/docker/docker-compose.prod.yml ps api

# 2. Check API logs for startup errors
docker compose -f infra/docker/docker-compose.prod.yml logs --tail=100 api

# 3. Can nginx reach the API internally?
docker compose -f infra/docker/docker-compose.prod.yml exec nginx \
  curl -s http://api:3001/api/v1/health

# 4. Is postgres healthy?
docker compose -f infra/docker/docker-compose.prod.yml exec postgres \
  pg_isready -U fleet_user -d fleet_db

# 5. Did migrations fail?
docker compose -f infra/docker/docker-compose.prod.yml logs api | grep -i "migration\|prisma"
```

If the API is stuck in migration (`prisma migrate deploy` waiting on postgres), postgres is likely not healthy yet. Wait 30 seconds and check again.

---

### OTP emails not arriving

```bash
# 1. Check SMTP config in .env.prod
grep SMTP infra/docker/.env.prod

# 2. Check API logs for mail errors
docker compose -f infra/docker/docker-compose.prod.yml logs api | grep -i "smtp\|mail\|otp"

# 3. Test SMTP connectivity from the server
nc -zv smtp.ideaforgetech.com 587

# 4. Verify COMPANY_EMAIL_DOMAIN matches the email being used to log in
grep COMPANY_EMAIL_DOMAIN infra/docker/.env.prod
```

If SMTP is not available during initial setup, the API logs the OTP to the console in non-production modes. In `NODE_ENV=production`, this fallback is disabled — SMTP must work for logins to function.

---

## Architecture Quick-Reference

```
Internet
   │
   ▼
Nginx (port 80 + 443)
   │  HTTP → HTTPS redirect
   │  Let's Encrypt TLS
   │
   ├──► /api/*          → api:3001  (NestJS — REST + WebSocket)
   ├──► /socket.io/*    → api:3001  (Socket.io long-poll / WS)
   └──► /*              → web-app:3000  (React SPA via nginx static)

Internal network (Docker — not reachable from internet):
   api ──────────────► postgres:5432  (PostgreSQL)
   api ──────────────► redis:6379     (Redis)
```

**Docker volumes (data persists across container restarts):**

| Volume | Contains |
|--------|---------|
| `postgres_data` | All application data — bookings, users, trips, assignments |
| `redis_data` | Session cache, rate limiting state |

**Files on the host (outside Docker volumes):**

| Path | Contains |
|------|---------|
| `/etc/letsencrypt/` | TLS certificates (mounted read-only into nginx) |
| `/opt/backups/` | Database backup files from `backup.sh` |

**Key commands cheat-sheet:**

```bash
# Alias setup (add to ~/.bashrc for convenience)
alias fleet='docker compose -f /opt/if-fleet/infra/docker/docker-compose.prod.yml'

# Usage:
fleet ps                        # service status
fleet logs -f api               # API logs
fleet restart api               # restart API
fleet exec api sh               # shell into API container
fleet down                      # stop all (data preserved)
fleet down -v                   # stop all + DELETE all data (DESTRUCTIVE)
```

---

*For local development setup see [SETUP.md](SETUP.md). For system architecture see [ARCHITECTURE.md](ARCHITECTURE.md). For end-user guidance see [USER_GUIDE.md](USER_GUIDE.md).*
