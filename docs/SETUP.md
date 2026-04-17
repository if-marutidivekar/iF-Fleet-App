# iF Fleet — Setup & Installation Guide

A complete, step-by-step guide for getting iF Fleet running — from a fresh machine to a fully working development environment, and onward to staging deployment.

> **New here?** Start at [System Requirements](#system-requirements) and follow every section in order. Each section links forward so you can skip parts you have already done.

---

## Table of Contents

- [System Requirements](#system-requirements)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Install Dependencies](#2-install-dependencies)
- [Environment Variables](#environment-variables)
  - [API Configuration](#api-configuration-appsapienv)
  - [Web App Configuration](#web-app-configuration-appswebenvlocal)
  - [Mobile App Configuration](#mobile-app-configuration-appsmobileenv)
  - [Generating Secrets](#generating-secrets)
- [Database Setup](#database-setup)
  - [Start the Database](#start-the-database)
  - [Run Migrations](#run-migrations)
  - [Seed Initial Data](#seed-initial-data)
- [Running the Application Locally](#running-the-application-locally)
  - [Start All Apps](#start-all-apps)
  - [Start Individual Apps](#start-individual-apps)
  - [Verify the Stack is Running](#verify-the-stack-is-running)
  - [First Login](#first-login)
- [Mobile Development](#mobile-development)
  - [Expo Go (Physical Device)](#expo-go-physical-device)
  - [Android Emulator](#android-emulator)
  - [iOS Simulator](#ios-simulator)
  - [Physical Device via ngrok](#physical-device-via-ngrok)
  - [Building for Distribution](#building-for-distribution-eas)
- [Running Tests](#running-tests)
- [Docker Setup](#docker-setup)
  - [Local Infrastructure Only](#local-infrastructure-only-recommended-for-development)
  - [Full Staging Stack](#full-staging-stack)
- [Staging Deployment](#staging-deployment)
  - [1. Build Docker Images](#1-build-docker-images)
  - [2. Configure Staging Environment](#2-configure-staging-environment)
  - [3. Deploy the Stack](#3-deploy-the-stack)
  - [4. Run Migrations on Staging](#4-run-migrations-on-staging)
  - [5. Verify Services](#5-verify-services)
  - [6. Run Smoke Tests](#6-run-smoke-tests)
- [Monitoring](#monitoring)
- [TLS / HTTPS Setup](#tls--https-setup)
- [CI/CD Overview](#cicd-overview)
- [Quick Reference — Useful Commands](#quick-reference--useful-commands)
- [Troubleshooting](#troubleshooting)

---

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| **OS** | Windows 10, macOS 12 Monterey, Ubuntu 20.04 | Windows 11, macOS 14 Sonoma, Ubuntu 22.04 |
| **RAM** | 8 GB | 16 GB (especially with Android emulator) |
| **Disk** | 10 GB free | 20 GB free |
| **CPU** | Any modern x64 | Multi-core (4+ cores speeds up builds) |
| **Network** | Internet access | Required for initial `pnpm install` and OTP email delivery |

> **Apple Silicon (M1/M2/M3):** Fully supported. Docker Desktop for Apple Silicon runs natively. Expo builds work on ARM without issues.

---

## Prerequisites

Install the following tools **before** cloning the repository. All commands below assume you have these in place.

### Required for Everyone

| Tool | Version | How to Install |
|------|---------|----------------|
| **Node.js** | ≥ 20 LTS | [nodejs.org](https://nodejs.org) — use the LTS installer, or use `nvm` (recommended) |
| **pnpm** | ≥ 9 | `npm install -g pnpm` after Node.js is installed |
| **Docker Desktop** | Latest | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) — includes Docker Compose v2 |
| **Git** | Any | [git-scm.com](https://git-scm.com/downloads) |

**Verify your installs:**

```bash
node -v        # should print v20.x.x or higher
pnpm -v        # should print 9.x.x or higher
docker -v      # should print Docker version 24.x.x or higher
docker compose version  # should print v2.x.x
git --version  # any version
```

> **Using nvm (recommended for managing Node versions):**
> ```bash
> # Install nvm (macOS/Linux)
> curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
> nvm install 20
> nvm use 20
>
> # Windows: use nvm-windows from https://github.com/coreybutler/nvm-windows
> ```

### Required for Mobile Development

| Tool | Platform | Purpose |
|------|----------|---------|
| **Expo Go** app | iOS / Android phone | Run the app on a real device without a build |
| **Android Studio** | Windows / macOS / Linux | Android emulator + SDK |
| **Xcode 15+** | macOS only | iOS simulator |

> You do **not** need Expo CLI globally installed — the project uses a local copy via pnpm.

---

## Installation

### 1. Clone the Repository

```bash
git clone <repo-url> iF_Fleet_App
cd iF_Fleet_App
```

> Replace `<repo-url>` with the actual repository URL. Ask your team lead if you do not have access.

### 2. Install Dependencies

From the monorepo root, install all dependencies for every app and package in one step:

```bash
pnpm install
```

pnpm workspaces automatically:
- Hoists shared packages to avoid duplication
- Links local packages (`@if-fleet/domain`, etc.) so they are importable immediately
- Installs dependencies for `apps/api`, `apps/web`, `apps/mobile`, and `packages/*`

This takes 2–5 minutes on first run. Subsequent installs are fast thanks to pnpm's content-addressable store.

---

## Environment Variables

Each app needs its own `.env` file. The repository includes `.env.example` files as templates — **never commit your actual `.env` files**.

### API Configuration (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and fill in the values:

```env
# ── Server ────────────────────────────────────────────────────────────────────
NODE_ENV=development
PORT=3001

# ── Database ──────────────────────────────────────────────────────────────────
# Matches the defaults in infra/docker/docker-compose.local.yml
DATABASE_URL=postgresql://fleet_user:fleet_pass@localhost:5432/fleet_db

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── JWT Authentication ────────────────────────────────────────────────────────
# Generate a strong secret (see "Generating Secrets" below)
JWT_SECRET=your-very-long-random-secret-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# ── Company Email Domain ──────────────────────────────────────────────────────
# Only emails ending in @this-domain can log in via OTP.
# For local dev using the seed data, set this to: ideaforgetech.com
COMPANY_EMAIL_DOMAIN=ideaforgetech.com

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow the web dev server to reach the API
CORS_ORIGINS=http://localhost:3000

# ── SMTP (Email / OTP delivery) ───────────────────────────────────────────────
# For development: use Mailtrap (https://mailtrap.io) — free, captures emails
# without actually sending them.
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-password
SMTP_FROM="iF Fleet <noreply@ideaforgetech.com>"

# ── PIN Security ──────────────────────────────────────────────────────────────
# Used for driver PIN uniqueness checking (HMAC-SHA256).
# Generate a random secret (see "Generating Secrets" below).
PIN_HMAC_SECRET=your-hmac-secret-here

# ── Push Notifications (optional for local dev) ───────────────────────────────
FCM_SERVER_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=

# ── Maps (optional for local dev) ─────────────────────────────────────────────
MAPBOX_ACCESS_TOKEN=
```

**Variable Reference:**

| Variable | Required | Description |
|----------|----------|-------------|
| `NODE_ENV` | Yes | Runtime environment: `development`, `staging`, `production` |
| `PORT` | No | API server port (default: `3001`) |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `JWT_SECRET` | Yes | Signs access tokens — must be at least 32 characters |
| `JWT_EXPIRES_IN` | No | Access token lifetime (default: `15m`) |
| `REFRESH_TOKEN_EXPIRES_IN` | No | Refresh token lifetime (default: `30d`) |
| `COMPANY_EMAIL_DOMAIN` | Yes | Only `@<domain>` emails can log in via OTP |
| `CORS_ORIGINS` | Yes | Comma-separated list of allowed frontend origins |
| `SMTP_HOST` | Yes | SMTP server for sending OTP emails |
| `SMTP_PORT` | No | SMTP port — `587` for STARTTLS, `465` for TLS |
| `SMTP_USER` | Yes | SMTP username |
| `SMTP_PASS` | Yes | SMTP password |
| `SMTP_FROM` | Yes | Sender name and address for outgoing emails |
| `PIN_HMAC_SECRET` | No | HMAC secret for driver PIN uniqueness checks |
| `FCM_SERVER_KEY` | No | Firebase Cloud Messaging key (push notifications) |
| `APNS_KEY_ID` | No | Apple Push Notification key ID |
| `APNS_TEAM_ID` | No | Apple developer team ID |
| `MAPBOX_ACCESS_TOKEN` | No | Mapbox API token for map tiles on the web app |

### Web App Configuration (`apps/web/.env.local`)

The web app proxies `/api` → `http://localhost:3001` through the Vite dev server — **no `.env` file is required** for basic local development.

If you need to override the API URL (e.g., to point at a remote staging server):

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
VITE_API_BASE_URL=/api/v1
```

### Mobile App Configuration (`apps/mobile/.env`)

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```env
# Use your machine's local IP address — NOT "localhost".
# Emulators and physical devices use a different network interface.
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api/v1
```

> **How to find your local IP:**
> - **Windows:** Run `ipconfig` in Command Prompt → look for "IPv4 Address" under your Wi-Fi adapter
> - **macOS/Linux:** Run `ifconfig` or `ip addr` → look for the `inet` address under `en0` or `wlan0`

**Example values by device type:**

| Device Type | API URL to Use |
|-------------|---------------|
| Physical phone (same Wi-Fi) | `http://192.168.1.100:3001/api/v1` (your machine's IP) |
| Android emulator | `http://10.0.2.2:3001/api/v1` (emulator alias for host `localhost`) |
| iOS simulator | `http://localhost:3001/api/v1` (shares host network) |

### Generating Secrets

Use these commands to generate cryptographically random secrets:

```bash
# Generate JWT_SECRET (64-character hex string)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate PIN_HMAC_SECRET (32-character hex string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Alternative using OpenSSL
openssl rand -hex 64   # JWT_SECRET
openssl rand -hex 32   # PIN_HMAC_SECRET
```

---

## Database Setup

iF Fleet uses **PostgreSQL 16** via Docker and **Prisma ORM** for schema management.

### Start the Database

Start only PostgreSQL and Redis (all that is needed for local development):

```bash
docker compose \
  -f infra/docker/docker-compose.staging.yml \
  -f infra/docker/docker-compose.local.yml \
  up -d postgres redis
```

The `docker-compose.local.yml` overlay exposes the database and Redis ports to your host machine (ports `5432` and `6379`), which Prisma and the API need during local development.

Verify both containers are running:

```bash
docker compose -f infra/docker/docker-compose.staging.yml ps
# postgres and redis should show status "healthy"
```

### Run Migrations

Switch to the API directory and apply all database migrations:

```bash
cd apps/api
pnpm db:migrate:dev
```

This creates all tables, indexes, foreign keys, and constraints defined in `prisma/schema.prisma`.

> **If `pnpm db:migrate:dev` fails with a shadow database error**, use the push command instead:
> ```bash
> pnpm exec prisma db push
> ```
> `db push` applies schema changes directly without a shadow database — suitable for local development. See [Troubleshooting](#troubleshooting) for details.

Return to the monorepo root when done:

```bash
cd ../..
```

### Seed Initial Data

The seed script creates demo accounts and sample master data for development and testing:

```bash
cd apps/api
pnpm db:seed
cd ../..
```

**What the seed creates:**

| Account | Email | Employee ID | Role |
|---------|-------|-------------|------|
| Admin | `admin@ideaforgetech.com` | `EMP-ADMIN-001` | Admin |
| Employee | `employee@ideaforgetech.com` | `EMP-001` | Employee |
| Driver | `driver@ideaforgetech.com` | `EMP-DRV-001` | Driver |

It also creates:
- 3 sample vehicles (Sedan, SUV, Van)
- A driver profile linked to the driver account
- Preset locations (Head Office, Depot, Field Site)
- App config with approval mode set to `MANUAL`

> **Seed is idempotent** — running it multiple times will not create duplicate records (`upsert` is used throughout).

> **Note on COMPANY_EMAIL_DOMAIN:** The seed accounts use `@ideaforgetech.com`. Make sure your `COMPANY_EMAIL_DOMAIN` in `apps/api/.env` is set to `ideaforgetech.com` for OTP login to work with these accounts.

---

## Running the Application Locally

### Start All Apps

From the monorepo root, run all apps in parallel with a single command:

```bash
pnpm dev
```

Turborepo builds shared packages first (`packages/domain`), then starts all three apps concurrently:

| App | URL | Notes |
|-----|-----|-------|
| **API** | http://localhost:3001/api/v1 | NestJS with hot-reload |
| **API Docs** | http://localhost:3001/api/docs | Swagger UI |
| **Web App** | http://localhost:3000 | Vite dev server with HMR |
| **Mobile** | QR in terminal | Expo Metro bundler |

Allow 15–30 seconds for everything to start on first run (the API compiles TypeScript; the web app bundles React).

### Start Individual Apps

If you only need one app running (e.g., you are only working on the API):

```bash
# API only (NestJS)
pnpm --filter @if-fleet/api dev

# Web app only (Vite)
pnpm --filter @if-fleet/web dev

# Mobile only (Expo Metro)
pnpm --filter @if-fleet/mobile dev
```

### Verify the Stack is Running

Open these URLs to confirm everything is working:

| Check | URL | Expected Response |
|-------|-----|-------------------|
| API health | http://localhost:3001/api/v1/health | `{ "status": "ok", "database": "ok", "redis": "ok" }` |
| Swagger UI | http://localhost:3001/api/docs | Interactive API explorer page |
| Web app | http://localhost:3000 | iF Fleet login page |
| Mobile | Scan QR in terminal | App opens on device/emulator |

If the health check shows `"database": "error"`, the API cannot reach PostgreSQL — see [Troubleshooting](#troubleshooting).

### First Login

#### Admin and Employee (Email OTP)

1. Open the web app at http://localhost:3000.
2. Enter `admin@ideaforgetech.com` (or `employee@ideaforgetech.com`).
3. Click **Send OTP**.
4. The OTP is sent via email — check your Mailtrap inbox (or SMTP logs) for the 6-digit code.
5. Enter the code and click **Sign In**.

> **Tip for local dev:** Use [Mailtrap.io](https://mailtrap.io) as your SMTP server. It catches all emails without sending them, making OTP testing easy. The free tier is sufficient.

#### Driver (Mobile PIN)

1. Open the mobile app.
2. Select the **Driver PIN** tab on the login screen.
3. Enter the driver's mobile number.
4. Enter the initial PIN set during driver profile creation (see the seed script or ask your admin).
5. On first login, you will be prompted to change the PIN.

---

## Mobile Development

### Expo Go (Physical Device)

The fastest way to test on a real device with no build required.

**Prerequisites:**
- Install **Expo Go** from the App Store (iOS) or Play Store (Android)
- Your phone and development machine must be on the **same Wi-Fi network**
- `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` must use your machine's LAN IP

**Steps:**

1. Set your machine's IP in the mobile `.env`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api/v1
   ```
2. Start the mobile dev server:
   ```bash
   pnpm --filter @if-fleet/mobile dev
   ```
3. Scan the QR code shown in the terminal with the Expo Go app.

### Android Emulator

**Prerequisites:** Android Studio installed with at least one AVD (Android Virtual Device) created.

```bash
pnpm --filter @if-fleet/mobile android
```

Use `http://10.0.2.2:3001/api/v1` as the `EXPO_PUBLIC_API_URL` — this is the Android emulator's built-in alias for the host machine's `localhost`.

### iOS Simulator

**Prerequisites:** macOS with Xcode 15+ installed and at least one simulator downloaded.

```bash
pnpm --filter @if-fleet/mobile ios
```

The iOS simulator shares the host network, so `http://localhost:3001/api/v1` works directly.

### Physical Device via ngrok

If your device cannot reach the development machine's local IP (e.g., different networks, VPN, or corporate Wi-Fi):

1. Install ngrok: [ngrok.com/download](https://ngrok.com/download)
2. Start a tunnel to the API:
   ```bash
   ngrok http 3001
   ```
3. Copy the forwarding URL (e.g., `https://abc123.ngrok-free.app`)
4. Update `apps/mobile/.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://abc123.ngrok-free.app/api/v1
   ```
5. Restart the Metro bundler.

> The mobile Axios client already includes the `ngrok-skip-browser-warning: true` header to bypass ngrok's browser interstitial page.

### Building for Distribution (EAS)

For distributing a test build to QA or internal testers:

```bash
# Install EAS CLI
npm install -g eas-cli

# Authenticate with Expo
eas login

# Build Android APK (internal testing)
cd apps/mobile
eas build --platform android --profile preview

# Build iOS IPA (TestFlight)
eas build --platform ios --profile preview
```

EAS build profiles are configured in `apps/mobile/eas.json`. Update `projectId` in `apps/mobile/app.json` if you connect a new Expo project.

---

## Running Tests

### Run All Tests (from Monorepo Root)

```bash
pnpm test
```

Turborepo runs tests in all packages in parallel. This includes unit tests for the API and web app.

### API Tests

```bash
# Unit tests (Vitest)
pnpm --filter @if-fleet/api test

# Watch mode (re-runs on file changes)
pnpm --filter @if-fleet/api test:watch

# Integration tests (requires running DB)
pnpm --filter @if-fleet/api test:integration
```

### Web App Tests

```bash
# Unit tests (Vitest)
pnpm --filter @if-fleet/web test

# Watch mode
pnpm --filter @if-fleet/web test:watch
```

### Mobile Tests

```bash
# Jest
pnpm --filter @if-fleet/mobile test
```

### TypeScript Type Checking

TypeScript errors do not always show up in tests. Run the type checker separately:

```bash
# Check all packages
pnpm typecheck

# Check a single app
pnpm --filter @if-fleet/api typecheck
pnpm --filter @if-fleet/web typecheck
pnpm --filter @if-fleet/mobile typecheck
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint and auto-fix
pnpm --filter @if-fleet/api lint
```

### All Checks Before Pushing

Run this sequence before opening a pull request:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

---

## Docker Setup

### Local Infrastructure Only (Recommended for Development)

For day-to-day development, you only need PostgreSQL and Redis running in Docker. The API, web app, and mobile run locally from source for fast hot-reload.

```bash
# Start only database and cache
docker compose \
  -f infra/docker/docker-compose.staging.yml \
  -f infra/docker/docker-compose.local.yml \
  up -d postgres redis
```

Stop when you are done:

```bash
docker compose \
  -f infra/docker/docker-compose.staging.yml \
  down
```

> **Do not use `down -v`** unless you want to delete all database data. Without `-v`, data persists across restarts via Docker volumes.

### Full Staging Stack

To run the complete stack locally (useful for testing Docker builds, nginx config, or the monitoring stack):

```bash
# From infra/docker/
docker compose -f docker-compose.staging.yml up -d
```

Services started:
- **nginx** — reverse proxy (ports 80 and 443)
- **web-app** — React SPA served by nginx
- **api** — NestJS API
- **postgres** — PostgreSQL database
- **redis** — Redis cache
- **loki** — Log aggregation
- **grafana** — Monitoring dashboards

> The full stack uses pre-built Docker images. Build them first — see [Staging Deployment](#staging-deployment).

---

## Staging Deployment

The staging stack runs all services on a single server using Docker Compose. The setup is designed for an on-premise or cloud VM.

### 1. Build Docker Images

From the monorepo root on your build machine (or CI server):

```bash
# Simple local build
docker build -f infra/docker/Dockerfile.api -t local/if-fleet-api:latest .
docker build -f infra/docker/Dockerfile.web -t local/if-fleet-web:latest .

# Tagged build with git SHA (recommended for staging)
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -f infra/docker/Dockerfile.api \
  -t ${REGISTRY}/if-fleet-api:${IMAGE_TAG} .
docker build -f infra/docker/Dockerfile.web \
  -t ${REGISTRY}/if-fleet-web:${IMAGE_TAG} .

# Push to your registry
docker push ${REGISTRY}/if-fleet-api:${IMAGE_TAG}
docker push ${REGISTRY}/if-fleet-web:${IMAGE_TAG}
```

The Dockerfiles use multi-stage builds:
- `Dockerfile.api`: builds NestJS → copies only `dist/` and production `node_modules` (~250 MB final image)
- `Dockerfile.web`: builds Vite → serves static files with nginx (~50 MB final image)

### 2. Configure Staging Environment

On the staging server, create the environment file:

```bash
cp infra/docker/.env.staging.template infra/docker/.env.staging
```

Edit `infra/docker/.env.staging` — replace every `CHANGE_ME` value:

```env
# Docker registry and image version
REGISTRY=registry.internal
IMAGE_TAG=abc1234

# Database
POSTGRES_DB=fleet_db
POSTGRES_USER=fleet_user
POSTGRES_PASSWORD=a-very-strong-random-password
DATABASE_URL=postgresql://fleet_user:a-very-strong-random-password@postgres:5432/fleet_db

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=staging
PORT=3001
CORS_ORIGINS=https://fleet.yourcompany.com
JWT_SECRET=<64-char-hex-from-openssl-rand-hex-32>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d
COMPANY_EMAIL_DOMAIN=yourcompany.com

# SMTP
SMTP_HOST=smtp.yourcompany.com
SMTP_PORT=587
SMTP_USER=fleet-noreply@yourcompany.com
SMTP_PASS=your-smtp-password
SMTP_FROM="iF Fleet <fleet-noreply@yourcompany.com>"

# PIN security
PIN_HMAC_SECRET=<32-char-hex-from-openssl-rand-hex-16>

# Push notifications
FCM_SERVER_KEY=your-firebase-server-key
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apple-team-id

# Grafana
GRAFANA_ADMIN_PASSWORD=a-strong-grafana-password
```

> ⚠️ **Never commit `.env.staging` to the repository.** It is listed in `.gitignore`. Store it in a secrets manager or pass it via CI/CD environment variables.

### 3. Deploy the Stack

```bash
cd infra/docker

docker compose \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  up -d
```

### 4. Run Migrations on Staging

Migrations must run **after** the database container is healthy but **before** the API serves traffic:

```bash
# Option A: Run in a temporary container using the API image
docker run --rm \
  --network if-fleet-internal \
  --env-file infra/docker/.env.staging \
  ${REGISTRY}/if-fleet-api:${IMAGE_TAG} \
  npx prisma migrate deploy

# Option B: Exec into the running API container
docker exec -it $(docker compose -f infra/docker/docker-compose.staging.yml ps -q api) \
  npx prisma migrate deploy
```

> Use `prisma migrate deploy` (not `migrate dev`) in staging and production — it applies pending migrations without creating new ones.

### 5. Verify Services

```bash
# Check all container statuses
docker compose -f infra/docker/docker-compose.staging.yml ps

# Follow API logs
docker compose -f infra/docker/docker-compose.staging.yml logs -f api

# Health check
curl https://fleet.yourcompany.com/api/v1/health
```

Expected response:
```json
{ "status": "ok", "database": "ok", "redis": "ok" }
```

### 6. Run Smoke Tests

```bash
bash infra/scripts/smoke-test.sh https://fleet.yourcompany.com
```

The script verifies:
1. API health endpoint returns 200
2. `/auth/request-otp` accepts a valid domain email
3. `/fleet/vehicles` returns 401 without a token (auth is working)
4. The web app returns 200

---

## Monitoring

### Grafana

Available at `https://fleet.yourcompany.com/grafana` (staging) or `http://localhost:3000` (local monitoring profile).

Default login: `admin` / value of `GRAFANA_ADMIN_PASSWORD` from `.env.staging`.

Pre-provisioned dashboards:
- **API Requests** — request rate, latency (p50/p95/p99), error rate
- **Database** — active connections, query count, slow queries
- **System** — container CPU and memory usage

### Loki (Log Aggregation)

All container logs are collected by Loki. Query them from Grafana's **Explore** view.

Useful filters:
- `{container="if-fleet-api"}` — API logs
- `{container="if-fleet-api"} |= "ERROR"` — API errors only
- `{container="if-fleet-api"} | json | level="error"` — Structured error logs

### Alert Rules

Configure alert rules in Grafana for:
- API error rate > 5% over 5 minutes → notify on-call
- Database connection failures → critical alert
- Container restart count > 0 → warning

---

## TLS / HTTPS Setup

### Option A — Let's Encrypt (Certbot) — Internet-Accessible Servers

```bash
# Install certbot
apt install certbot

# Stop nginx temporarily, generate certificates
certbot certonly --standalone -d fleet.yourcompany.com

# Certificates are placed at:
# /etc/letsencrypt/live/fleet.yourcompany.com/fullchain.pem
# /etc/letsencrypt/live/fleet.yourcompany.com/privkey.pem
```

Mount the certificates into the nginx container in `docker-compose.staging.yml`:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt/live/fleet.yourcompany.com:/etc/nginx/certs:ro
```

Set up automatic renewal with cron:

```bash
0 0 1 * * certbot renew --quiet && \
  docker compose -f /path/to/docker-compose.staging.yml restart nginx
```

### Option B — Self-Signed Certificate (Internal / Staging)

For internal networks where Let's Encrypt cannot reach the server:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/docker/nginx/certs/fleet.key \
  -out   infra/docker/nginx/certs/fleet.crt \
  -subj  "/CN=fleet.yourcompany.internal"
```

Then update `infra/nginx/nginx.staging.conf` to reference these paths and enable the HTTPS `server` block.

---

## CI/CD Overview

A recommended GitHub Actions (or Gitea CI) pipeline:

```yaml
# .github/workflows/deploy.yml

on:
  push:
    branches: [main, develop]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test

  build-and-push:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build and tag images
        run: |
          IMAGE_TAG=${{ github.sha }}
          docker build -f infra/docker/Dockerfile.api -t $REGISTRY/if-fleet-api:$IMAGE_TAG .
          docker build -f infra/docker/Dockerfile.web -t $REGISTRY/if-fleet-web:$IMAGE_TAG .
          docker push $REGISTRY/if-fleet-api:$IMAGE_TAG
          docker push $REGISTRY/if-fleet-web:$IMAGE_TAG

  deploy-staging:
    needs: build-and-push
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging server
        run: |
          ssh deploy@staging-server "
            cd /opt/if-fleet &&
            IMAGE_TAG=${{ github.sha }} docker compose \
              -f infra/docker/docker-compose.staging.yml \
              --env-file infra/docker/.env.staging \
              pull &&
            docker compose up -d &&
            docker exec if-fleet-api-1 npx prisma migrate deploy &&
            bash infra/scripts/smoke-test.sh https://fleet.yourcompany.com
          "
```

---

## Quick Reference — Useful Commands

### Monorepo (from root)

```bash
pnpm dev                    # Start all apps in parallel
pnpm build                  # Build all apps for production
pnpm typecheck              # TypeScript check all packages
pnpm lint                   # ESLint all packages
pnpm format                 # Prettier format all files
pnpm format:check           # Check formatting without fixing
pnpm test                   # Run all tests
```

### Database (from `apps/api/`)

```bash
pnpm db:migrate:dev             # Create and apply a new migration (development)
pnpm db:migrate:dev --name xyz  # Create a named migration
pnpm exec prisma db push        # Push schema changes directly (no migration file)
pnpm db:migrate                 # Apply pending migrations (staging/production)
pnpm db:seed                    # Run the seed script
pnpm db:generate                # Regenerate Prisma client after schema changes
pnpm db:studio                  # Open Prisma Studio at http://localhost:5555
```

### Docker

```bash
# Start dev infrastructure (DB + Redis only)
docker compose \
  -f infra/docker/docker-compose.staging.yml \
  -f infra/docker/docker-compose.local.yml \
  up -d postgres redis

# Start full staging stack
docker compose -f infra/docker/docker-compose.staging.yml up -d

# View logs for a specific service
docker compose -f infra/docker/docker-compose.staging.yml logs -f api

# Restart a single service
docker compose -f infra/docker/docker-compose.staging.yml restart api

# Stop all services (preserves data volumes)
docker compose -f infra/docker/docker-compose.staging.yml down

# Stop all services AND delete all data (DESTRUCTIVE)
docker compose -f infra/docker/docker-compose.staging.yml down -v
```

### Git (Feature Branch Workflow)

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Push and open PR
git push origin feature/your-feature-name
# Open PR: feature/your-feature-name → develop

# Release to main
git checkout main
git merge develop
git tag v1.0.0
git push origin main --tags
```

---

## Troubleshooting

### `pnpm install` fails with workspace-related errors

Ensure you are using pnpm ≥ 9:

```bash
pnpm -v                     # Check version
npm install -g pnpm@latest  # Upgrade if needed
```

Also ensure you are running `pnpm install` from the **monorepo root** (the directory containing `pnpm-workspace.yaml`), not from inside an individual app.

---

### API cannot connect to PostgreSQL

**Symptom:** API health check shows `"database": "error"` or the API crashes on startup.

1. Verify containers are running:
   ```bash
   docker compose -f infra/docker/docker-compose.staging.yml ps
   ```
2. Check the `DATABASE_URL` in `apps/api/.env` — the host should be `localhost`, user should be `fleet_user`, and port should be `5432`.
3. Test the connection directly:
   ```bash
   docker exec -it <postgres-container-name> \
     psql -U fleet_user -d fleet_db -c "SELECT 1;"
   ```
4. Check PostgreSQL logs:
   ```bash
   docker compose -f infra/docker/docker-compose.staging.yml logs postgres
   ```

---

### `prisma migrate dev` fails with shadow database error

**Symptom:** Error referencing a shadow database or sequence bounds (e.g., `setval: value 0 is out of bounds`).

This can happen when the database contains manually-created or out-of-sequence data. Use the push command for local development:

```bash
cd apps/api
pnpm exec prisma db push
```

`db push` synchronises the schema directly without a shadow database. It is safe for local development. For staging and production, always use `pnpm db:migrate` (`prisma migrate deploy`).

---

### `prisma generate` fails with EPERM or DLL file locked

**Symptom:** Windows error: `EPERM: operation not permitted` on a `.dll` file in `node_modules/.prisma`.

This happens when the API server (NestJS) is running and has the Prisma native binary loaded.

**Fix:** Stop the API server, run `pnpm db:generate`, then restart the server.

```bash
# Stop the API (Ctrl+C in its terminal), then:
cd apps/api
pnpm db:generate

# Restart the API
pnpm dev  # (or pnpm --filter @if-fleet/api dev)
```

---

### Migration fails: "relation already exists"

The database has tables from a previous incomplete migration. Options:

```bash
# Option A: Reset the dev database entirely (DESTRUCTIVE — loses all data)
cd apps/api
pnpm exec prisma migrate reset

# Option B: Mark a specific migration as already applied
pnpm exec prisma migrate resolve --applied 20260409090744_init
```

---

### Mobile app shows "Network request failed"

**Checklist:**

1. `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` must use your machine's **LAN IP address**, not `localhost`:
   ```env
   EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api/v1
   ```
2. Verify the API is actually running and reachable:
   ```bash
   curl http://192.168.1.100:3001/api/v1/health
   ```
3. Ensure both your phone/emulator and development machine are on the **same Wi-Fi network**.
4. Check that no firewall on your machine is blocking port `3001`.
5. If still failing, use [ngrok](#physical-device-via-ngrok) as an alternative.

**Android emulator specifically:** Use `http://10.0.2.2:3001/api/v1` — the emulator cannot reach your host's LAN IP directly.

---

### OTP emails not arriving

1. Verify SMTP credentials in `apps/api/.env` are correct.
2. For local development, use [Mailtrap](https://mailtrap.io) — it catches all emails without sending and has a free tier.
3. Check API logs for SMTP errors:
   ```bash
   # If running locally
   pnpm --filter @if-fleet/api dev
   # Look for lines containing "SMTP" or "mail"

   # If running in Docker
   docker compose -f infra/docker/docker-compose.staging.yml logs api | grep -i smtp
   ```
4. Make sure `COMPANY_EMAIL_DOMAIN` matches the domain of the email you are using to log in. If the seed uses `@ideaforgetech.com`, this must be set to `ideaforgetech.com`.

---

### 401 Unauthorized errors persisting after login

1. Check that `JWT_SECRET` in `.env` has not changed since the tokens were issued. Changing it invalidates all existing tokens.
2. Check `JWT_EXPIRES_IN` — the default is `15m`. The app auto-refreshes tokens silently. If you are getting persistent 401s, the refresh token may have expired.
3. Inspect the `DeviceSession` table in Prisma Studio to see if the session is marked as revoked:
   ```bash
   cd apps/api && pnpm db:studio
   ```

---

### TypeScript errors after pulling latest changes

Shared packages must be built before apps can import them:

```bash
# Rebuild the domain package
pnpm --filter @if-fleet/domain build

# Then typecheck
pnpm typecheck
```

---

### `tsc` error: cannot find module `@if-fleet/domain`

The domain package has not been built yet:

```bash
pnpm --filter @if-fleet/domain build
```

If the problem persists, try a full clean build:

```bash
# Remove all build artifacts
find . -name "dist" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true

# Rebuild everything
pnpm build
```

---

### Docker images are too large

The multi-stage Dockerfiles should produce compact images. Check sizes:

```bash
docker images | grep if-fleet
# API image: ~250 MB
# Web image:  ~50 MB (nginx serving static files)
```

If images are significantly larger:
- Verify `.dockerignore` files exist in `apps/api/` and `apps/web/` (they exclude `node_modules`, `.git`, etc.)
- Check that the multi-stage build is not accidentally including dev dependencies in the final stage

---

### Grafana shows "No data" on dashboards

1. Confirm Loki is running:
   ```bash
   docker compose -f infra/docker/docker-compose.staging.yml ps loki
   ```
2. In Grafana: go to **Configuration → Data Sources → Loki**
3. Verify the URL is `http://loki:3100`
4. Click **Test** — it should return "Data source connected and labels found"

---

*For system architecture details see [ARCHITECTURE.md](ARCHITECTURE.md). For end-user guidance see [USER_GUIDE.md](USER_GUIDE.md). For role-based feature walkthroughs see the [README](../README.md).*
