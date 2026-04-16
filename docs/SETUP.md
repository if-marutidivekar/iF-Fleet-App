# iF Fleet — Setup & Installation Guide

This guide covers local development setup, staging Docker deployment, mobile distribution, and production hardening.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
  - [1. Clone & Install](#1-clone--install)
  - [2. Start Infrastructure](#2-start-infrastructure)
  - [3. Configure Environment](#3-configure-environment)
  - [4. Database Setup](#4-database-setup)
  - [5. Start the Applications](#5-start-the-applications)
  - [6. Verify the Stack](#6-verify-the-stack)
- [Environment Variables Reference](#environment-variables-reference)
- [Mobile Development](#mobile-development)
  - [Running on Expo Go](#running-on-expo-go)
  - [Running on a Simulator](#running-on-a-simulator)
  - [API URL for Physical Devices](#api-url-for-physical-devices)
- [Staging Deployment (Docker)](#staging-deployment-docker)
  - [1. Build Docker Images](#1-build-docker-images)
  - [2. Configure Staging Environment](#2-configure-staging-environment)
  - [3. Deploy the Stack](#3-deploy-the-stack)
  - [4. Run Migrations](#4-run-migrations)
  - [5. Verify Services](#5-verify-services)
- [Smoke Tests](#smoke-tests)
- [Monitoring](#monitoring)
- [TLS / HTTPS Setup](#tls--https-setup)
- [CI/CD Overview](#cicd-overview)
- [Useful Commands Reference](#useful-commands-reference)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20 | `node -v` |
| pnpm | ≥ 9 | `npm install -g pnpm` |
| Docker Desktop | Latest | Includes Docker Compose v2 |
| Git | Any | |
| Expo CLI | Latest | `npm install -g expo-cli` (optional, Expo Go handles most cases) |

**For mobile development:**
- Android Studio (Android SDK) — for Android emulator
- Xcode 15+ (macOS only) — for iOS simulator
- Expo Go app installed on physical device (iOS / Android)

---

## Local Development Setup

### 1. Clone & Install

```bash
git clone <repo-url> iF_Fleet_App
cd iF_Fleet_App

# Install all workspace dependencies (API + web + mobile + packages)
pnpm install
```

> pnpm workspaces automatically hoist shared dependencies and link local packages (`@if-fleet/domain`, etc.).

---

### 2. Start Infrastructure

Start only PostgreSQL and Redis for local development (no nginx, no Grafana needed):

```bash
docker compose \
  -f infra/docker/docker-compose.staging.yml \
  -f infra/docker/docker-compose.local.yml \
  up -d postgres redis
```

Verify containers are running and healthy:

```bash
docker compose -f infra/docker/docker-compose.staging.yml ps
# postgres and redis should show "healthy"
```

Default ports (local only, not exposed in staging):
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

---

### 3. Configure Environment

#### API

```bash
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env` with your values:

```env
NODE_ENV=development
PORT=3001

# Database (matches docker-compose.local.yml defaults)
DATABASE_URL=postgresql://fleet_user:fleet_pass@localhost:5432/fleet_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT — generate a strong random secret:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-very-long-random-secret-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=30d

# Company email domain (only emails @this-domain can register/login)
COMPANY_EMAIL_DOMAIN=yourcompany.com

# CORS — allow web dev server
CORS_ORIGINS=http://localhost:3000

# SMTP (use Mailtrap, Mailhog, or a real SMTP server)
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=your-mailtrap-user
SMTP_PASS=your-mailtrap-pass
SMTP_FROM="iF Fleet <noreply@yourcompany.com>"

# PIN security (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
PIN_HMAC_SECRET=your-hmac-secret-here

# Optional — leave blank for local dev
FCM_SERVER_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=
MAPBOX_ACCESS_TOKEN=
```

#### Web App

The web app proxies `/api` to `http://localhost:3001` via Vite config — no additional `.env` needed for local development.

For custom configuration:

```bash
cp apps/web/.env.example apps/web/.env.local
```

```env
VITE_API_BASE_URL=/api/v1
```

#### Mobile App

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```env
# Point to your local machine's IP (not localhost — emulators use a different loopback)
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001/api/v1

# Or use ngrok for physical device access (see Mobile Development section)
# EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app/api/v1
```

> Find your local IP: `ipconfig` (Windows) or `ifconfig` / `ip addr` (Linux/Mac)

---

### 4. Database Setup

Run migrations to create all tables:

```bash
cd apps/api
pnpm db:migrate:dev
```

Seed initial data (preset locations, admin account, sample vehicles):

```bash
pnpm db:seed
```

> The seed script creates a default admin account. Check `prisma/seed.ts` for the seeded email address and change the password/PIN on first login.

Optionally open Prisma Studio (database browser):

```bash
pnpm prisma studio
# Opens at http://localhost:5555
```

Return to monorepo root:

```bash
cd ../..
```

---

### 5. Start the Applications

From the monorepo root, start all apps in parallel:

```bash
pnpm dev
```

This runs (via Turborepo):
- `apps/api` → NestJS dev server on **http://localhost:3001**
- `apps/web` → Vite dev server on **http://localhost:3000**
- `apps/mobile` → Expo Metro bundler (scan QR with Expo Go)

Or start individually:

```bash
# API only
pnpm --filter api dev

# Web only
pnpm --filter web dev

# Mobile only
pnpm --filter mobile dev
```

---

### 6. Verify the Stack

| Check | URL | Expected |
|-------|-----|---------|
| API health | http://localhost:3001/api/v1/health | `{ "status": "ok" }` |
| Swagger docs | http://localhost:3001/api/docs | Interactive API explorer |
| Web app | http://localhost:3000 | Login page |
| Mobile | Expo Metro QR | Scan with Expo Go |

---

## Environment Variables Reference

### API (`apps/api/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `development`, `staging`, `production` |
| `PORT` | No | `3001` | API server port |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `15m` | Access token TTL (e.g., `15m`, `1h`) |
| `REFRESH_TOKEN_EXPIRES_IN` | No | `30d` | Refresh token TTL (e.g., `7d`, `30d`) |
| `COMPANY_EMAIL_DOMAIN` | Yes | `company.com` | Allowed email domain for OTP login |
| `CORS_ORIGINS` | Yes | — | Comma-separated allowed origins |
| `SMTP_HOST` | Yes | — | SMTP server hostname |
| `SMTP_PORT` | No | `587` | SMTP port (587 for STARTTLS, 465 for SSL) |
| `SMTP_USER` | Yes | — | SMTP username |
| `SMTP_PASS` | Yes | — | SMTP password |
| `SMTP_FROM` | Yes | — | Sender display name + email |
| `PIN_HMAC_SECRET` | No | dev default | HMAC secret for PIN uniqueness checks |
| `FCM_SERVER_KEY` | No | — | Firebase Cloud Messaging server key |
| `APNS_KEY_ID` | No | — | Apple Push Notification key ID |
| `APNS_TEAM_ID` | No | — | Apple developer team ID |
| `MAPBOX_ACCESS_TOKEN` | No | — | Mapbox API token for map tiles |

### Mobile (`apps/mobile/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Yes | Full base URL of the API including `/api/v1` |
| `REACT_NATIVE_PACKAGER_HOSTNAME` | No | Metro bundler bind address (for device access) |

---

## Mobile Development

### Running on Expo Go

1. Install **Expo Go** from the App Store / Play Store on your phone.
2. Ensure your phone and development machine are on the **same WiFi network**.
3. Set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your machine's local IP:
   ```
   EXPO_PUBLIC_API_URL=http://192.168.1.100:3001/api/v1
   ```
4. Run `pnpm dev` (or `pnpm --filter mobile dev`).
5. Scan the QR code shown in the Metro terminal with Expo Go.

### Running on a Simulator

**Android (Android Studio):**
```bash
pnpm --filter mobile android
```

**iOS (macOS + Xcode required):**
```bash
pnpm --filter mobile ios
```

For Android emulators, use `http://10.0.2.2:3001/api/v1` as the API URL (emulator's alias for host `localhost`).

### API URL for Physical Devices (ngrok)

If your device cannot reach the development machine directly, use ngrok:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3001
```

Copy the forwarding URL (e.g., `https://xxxx.ngrok-free.app`) and set:

```env
EXPO_PUBLIC_API_URL=https://xxxx.ngrok-free.app/api/v1
```

> The `ngrok-skip-browser-warning: true` header is already set in the mobile Axios client to bypass ngrok's interstitial page.

### Building for Distribution (EAS Build)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build for Android (APK for internal testing)
cd apps/mobile
eas build --platform android --profile preview

# Build for iOS (simulator or TestFlight)
eas build --platform ios --profile preview
```

EAS configuration is in `apps/mobile/eas.json`. Update `projectId` in `app.json` if you change the Expo project.

---

## Staging Deployment (Docker)

The staging stack runs all services on a single server using Docker Compose.

### 1. Build Docker Images

From the monorepo root:

```bash
# Build all images
docker build -f infra/docker/Dockerfile.api -t local/if-fleet-api:latest .
docker build -f infra/docker/Dockerfile.web -t local/if-fleet-web:latest .
```

Or use the Turborepo build pipeline and tag:

```bash
IMAGE_TAG=$(git rev-parse --short HEAD)
docker build -f infra/docker/Dockerfile.api -t ${REGISTRY}/if-fleet-api:${IMAGE_TAG} .
docker build -f infra/docker/Dockerfile.web -t ${REGISTRY}/if-fleet-web:${IMAGE_TAG} .
docker push ${REGISTRY}/if-fleet-api:${IMAGE_TAG}
docker push ${REGISTRY}/if-fleet-web:${IMAGE_TAG}
```

### 2. Configure Staging Environment

On the staging server:

```bash
cp infra/docker/.env.staging.template infra/docker/.env.staging
```

Edit `.env.staging` — replace every `CHANGE_ME` value:

```env
REGISTRY=registry.internal          # Your Docker registry
IMAGE_TAG=abc1234                   # Git SHA or semantic version

# Database
POSTGRES_DB=fleet_db
POSTGRES_USER=fleet_user
POSTGRES_PASSWORD=strong-random-password-here
DATABASE_URL=postgresql://fleet_user:strong-random-password-here@postgres:5432/fleet_db

# Redis
REDIS_URL=redis://redis:6379

# Application
NODE_ENV=staging
PORT=3001
CORS_ORIGINS=https://fleet.yourcompany.com
JWT_SECRET=generate-64-char-hex-with-openssl-rand-hex-32
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
PIN_HMAC_SECRET=generate-32-char-hex-with-openssl-rand-hex-16

# Push notifications
FCM_SERVER_KEY=your-firebase-server-key
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apple-team-id

# Monitoring
GRAFANA_ADMIN_PASSWORD=strong-grafana-password
```

> **Never commit `.env.staging` to the repository.** It is in `.gitignore`.

### 3. Deploy the Stack

```bash
cd infra/docker

docker compose \
  -f docker-compose.staging.yml \
  --env-file .env.staging \
  up -d
```

### 4. Run Migrations

Migrations must run **after** the database container is healthy but **before** the API receives traffic:

```bash
# Run migrations in a temporary container using the same image
docker run --rm \
  --network if-fleet-internal \
  --env-file infra/docker/.env.staging \
  local/if-fleet-api:latest \
  npx prisma migrate deploy
```

Or exec into the running API container:

```bash
docker exec -it if-fleet-api-1 npx prisma migrate deploy
```

### 5. Verify Services

```bash
# Check all containers
docker compose -f infra/docker/docker-compose.staging.yml ps

# Follow API logs
docker compose -f infra/docker/docker-compose.staging.yml logs -f api

# Health check
curl https://fleet.yourcompany.com/api/v1/health
```

Expected health response:
```json
{ "status": "ok", "database": "ok", "redis": "ok" }
```

---

## Smoke Tests

Run the smoke test script after deployment:

```bash
bash infra/scripts/smoke-test.sh https://fleet.yourcompany.com
```

The script checks:
1. API health endpoint responds 200
2. `/auth/request-otp` accepts a valid domain email
3. `/fleet/vehicles` requires authentication (returns 401 without token)
4. Static web app serves `index.html`

---

## Monitoring

### Grafana

Available at `https://fleet.yourcompany.com/grafana` (or `http://localhost:3000` if using the local monitoring profile).

Default login: `admin` / value of `GRAFANA_ADMIN_PASSWORD` in `.env.staging`.

Pre-provisioned dashboards:
- **API Requests** — request rate, latency, error rate
- **Database** — query count, slow queries
- **System** — container CPU, memory

### Loki (Logs)

Logs from all containers are collected by Loki and available in Grafana's Explore view. Filter by container name (`container=if-fleet-api`) or log level.

### Alerting

Configure alert rules in Grafana for:
- API error rate > 5% over 5 minutes
- Database connection failures
- Container restart count > 0

---

## TLS / HTTPS Setup

### Option A — Let's Encrypt (Certbot)

```bash
# Install certbot on the host
apt install certbot

# Generate certificates (nginx must be stopped temporarily)
certbot certonly --standalone -d fleet.yourcompany.com

# Certificates are at:
# /etc/letsencrypt/live/fleet.yourcompany.com/fullchain.pem
# /etc/letsencrypt/live/fleet.yourcompany.com/privkey.pem
```

Mount the certificates into the nginx container in `docker-compose.staging.yml`:

```yaml
nginx:
  volumes:
    - /etc/letsencrypt/live/fleet.yourcompany.com:/etc/nginx/certs:ro
```

Update `infra/nginx/nginx.conf` to reference the cert paths and enable HTTPS.

Auto-renew with cron:

```bash
0 0 1 * * certbot renew --quiet && docker compose -f /path/to/docker-compose.staging.yml restart nginx
```

### Option B — Self-Signed (Internal / Staging Only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout infra/nginx/certs/fleet.key \
  -out infra/nginx/certs/fleet.crt \
  -subj "/CN=fleet.yourcompany.internal"
```

---

## CI/CD Overview

Recommended pipeline (GitHub Actions or Gitea CI):

```yaml
# .github/workflows/deploy.yml (sketch)

on:
  push:
    branches: [main, develop]

jobs:
  validate:
    steps:
      - pnpm install
      - pnpm typecheck
      - pnpm lint
      - pnpm test

  build:
    needs: validate
    steps:
      - docker build api + web images
      - tag with git SHA
      - push to registry

  deploy:
    needs: build
    if: branch == 'main'
    steps:
      - SSH to staging server
      - docker compose pull
      - docker compose up -d
      - npx prisma migrate deploy (in API container)
      - bash infra/scripts/smoke-test.sh
```

---

## Useful Commands Reference

### Monorepo

```bash
pnpm dev                          # Start all apps (turbo parallel)
pnpm build                        # Build all apps
pnpm typecheck                    # TypeScript check all packages
pnpm lint                         # ESLint all packages
pnpm format                       # Prettier format
pnpm test                         # Run all tests
```

### Database (from `apps/api/`)

```bash
pnpm db:migrate:dev               # Create + apply migration (development)
pnpm db:migrate                   # Apply pending migrations (production)
pnpm db:migrate:dev --name <name> # Create named migration
pnpm db:seed                      # Run seed script
pnpm prisma studio                # Open Prisma Studio (DB browser)
pnpm prisma generate              # Regenerate Prisma client after schema changes
pnpm prisma db pull               # Introspect existing DB (reverse-engineer schema)
```

### Docker

```bash
# Start full staging stack
docker compose -f infra/docker/docker-compose.staging.yml up -d

# Start only DB + Redis (local dev)
docker compose -f infra/docker/docker-compose.staging.yml \
               -f infra/docker/docker-compose.local.yml \
               up -d postgres redis

# View logs
docker compose -f infra/docker/docker-compose.staging.yml logs -f api

# Restart single service
docker compose -f infra/docker/docker-compose.staging.yml restart api

# Stop all
docker compose -f infra/docker/docker-compose.staging.yml down

# Stop + remove volumes (DESTRUCTIVE — loses all data)
docker compose -f infra/docker/docker-compose.staging.yml down -v
```

### Git

```bash
# Feature branch workflow
git checkout -b feature/your-feature develop
# ... make changes ...
git push origin feature/your-feature
# Open PR → develop

# Release
git checkout main
git merge develop
git tag v0.2.0
git push origin main --tags
```

---

## Troubleshooting

### `pnpm install` fails with workspace errors

Ensure you are using pnpm ≥ 9:
```bash
pnpm -v
npm install -g pnpm@latest
```

### API cannot connect to PostgreSQL

Check the DATABASE_URL matches the Docker container credentials:
```bash
docker compose -f infra/docker/docker-compose.staging.yml logs postgres
docker exec -it <postgres-container> psql -U fleet_user -d fleet_db -c "SELECT 1;"
```

### Migration fails: "relation already exists"

Your database has stale tables from a previous run. Either:
- Reset development DB: `pnpm prisma migrate reset` (DESTRUCTIVE)
- Mark migration as applied: `pnpm prisma migrate resolve --applied <migration_name>`

### Mobile app shows `Network request failed`

1. Verify `EXPO_PUBLIC_API_URL` is set to your machine's LAN IP (not `localhost`).
2. Ensure the API is running and the port is reachable from the device.
3. Disable any VPN on the device that might block local network traffic.
4. Try ngrok as an alternative (see [API URL for Physical Devices](#api-url-for-physical-devices)).

### OTP emails not arriving

1. Check SMTP credentials in `.env`.
2. For development, use Mailtrap (https://mailtrap.io) which captures emails without sending.
3. Check API logs: `docker compose logs api | grep SMTP`

### 401 Unauthorized after some time

The access token has expired and the refresh token flow kicked in. If still getting 401:
- Check `JWT_SECRET` is the same in `.env` as when tokens were issued.
- Check `REFRESH_TOKEN_EXPIRES_IN` — if `30d` has passed, users must log in again.
- Check `DeviceSession` table for revoked sessions.

### `tsc` errors after pulling changes

1. Rebuild shared packages first: `pnpm --filter @if-fleet/domain build`
2. Then run typecheck: `pnpm typecheck`

### Docker images too large

The multi-stage Dockerfiles should produce small images. If sizes are large:
```bash
docker images | grep if-fleet
# API should be ~250MB, web ~50MB (nginx serving static files)
```

Ensure `.dockerignore` files are present in `apps/api/` and `apps/web/` to exclude `node_modules`, `.git`, etc.

### Grafana shows "No data"

Ensure Loki is running and the Grafana datasource is configured:
1. Open Grafana → Configuration → Data Sources
2. Verify Loki datasource URL is `http://loki:3100`
3. Test the connection

---

*For architecture details see [ARCHITECTURE.md](ARCHITECTURE.md). For end-user guidance see [USER_GUIDE.md](USER_GUIDE.md).*
