# iF Fleet — Company Fleet Management Platform

A full-stack, multi-role fleet management platform for employee transport and material movement. Built as a monorepo covering a **React web app**, **React Native mobile app** (Expo), and a **NestJS API** — all sharing TypeScript types from a common domain package.

---

## Table of Contents

- [Overview](#overview)
- [Roles](#roles)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Quick Start (Local Development)](#quick-start-local-development)
- [Documentation](#documentation)
- [Key Features](#key-features)
- [Booking Lifecycle](#booking-lifecycle)
- [Fleet Assignment Lifecycle](#fleet-assignment-lifecycle)
- [Contributing](#contributing)

---

## Overview

iF Fleet replaces a manual, coordinator-driven process with a structured digital workflow:

1. **Employees** submit transport or material-movement requests from web or mobile.
2. **Admins** approve requests and assign vehicles and drivers (or let the system auto-assign when a preferred vehicle is selected).
3. **Drivers** accept assignments, set their current location, and execute trips with real-time status updates.
4. **Admins** monitor live fleet status, view history, manage master data, and configure system settings.

---

## Roles

| Role | Primary Surface | Key Capabilities |
|------|----------------|-----------------|
| **Employee** | Web + Mobile | Submit bookings, track active trips, view booking history |
| **Driver** | Mobile | Accept/decline assignments, manage fleet vehicle, set location, execute trips |
| **Admin** | Web + Mobile | Approve bookings, assign fleet, manage users/vehicles/drivers, view reports |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS 10, TypeScript 5, Passport-JWT |
| Database | PostgreSQL 16 + Prisma ORM 5 |
| Cache / Sessions | Redis 7 |
| Web App | React 18, Vite 5, React Router v6, TanStack Query 5, Zustand 4 |
| Mobile App | React Native 0.81 (Expo SDK 54), Expo Router 6, TanStack Query 5 |
| Real-time | Socket.io 4 |
| Email | Nodemailer |
| Push Notifications | Firebase Cloud Messaging (FCM) + APNs |
| Monorepo | Turborepo + pnpm workspaces |
| Infrastructure | Docker Compose, Nginx, Grafana + Loki |

---

## Repository Structure

```
iF_Fleet_App/
├── apps/
│   ├── api/                  # NestJS backend
│   │   ├── src/
│   │   │   ├── modules/      # Feature modules (auth, bookings, fleet, trips, …)
│   │   │   └── common/       # Guards, decorators, Prisma, health
│   │   └── prisma/           # Schema + migrations + seed
│   ├── web/                  # React + Vite admin/employee web app
│   │   └── src/
│   │       ├── pages/        # Role-gated pages (admin/, driver/, employee/)
│   │       ├── stores/       # Zustand auth store
│   │       └── lib/          # Axios instance, React Query config
│   └── mobile/               # Expo React Native app
│       └── app/
│           ├── (admin)/      # Admin tab group (7 tabs)
│           ├── (driver)/     # Driver tab group (6 tabs)
│           ├── (employee)/   # Employee tab group (5 tabs)
│           └── (auth)/       # Login + complete-profile screens
├── packages/
│   ├── domain/               # Shared TypeScript enums, entities, state machines
│   ├── api-contracts/        # OpenAPI spec (generated from Swagger)
│   └── ui/                   # Shared UI component library (in progress)
├── infra/
│   ├── docker/               # Dockerfiles + docker-compose files
│   ├── nginx/                # Nginx config + TLS certs
│   ├── monitoring/           # Loki + Grafana provisioning
│   └── scripts/              # Migration runner, seed, smoke-test, backup
└── docs/
    ├── USER_GUIDE.md         # End-user guide (Admin / Driver / Employee)
    ├── ARCHITECTURE.md       # System architecture deep-dive
    └── SETUP.md              # Installation & deployment guide
```

---

## Quick Start (Local Development)

### Prerequisites

- Node.js ≥ 20, pnpm ≥ 9
- Docker Desktop (for PostgreSQL + Redis)
- Expo Go on a physical device, or an Android/iOS simulator

### 1. Clone & Install

```bash
git clone <repo-url> iF_Fleet_App
cd iF_Fleet_App
pnpm install
```

### 2. Start Infrastructure

```bash
docker compose -f infra/docker/docker-compose.staging.yml \
               -f infra/docker/docker-compose.local.yml \
               up -d postgres redis
```

### 3. Configure the API

```bash
cp apps/api/.env.example apps/api/.env
# Edit apps/api/.env — set DATABASE_URL, JWT_SECRET, COMPANY_EMAIL_DOMAIN, SMTP_*
```

### 4. Run Migrations & Seed

```bash
cd apps/api
pnpm db:migrate:dev
pnpm db:seed
```

### 5. Start All Apps

```bash
# From monorepo root — starts API (3001), web (3000), and mobile Metro bundler in parallel
pnpm dev
```

- **API:** http://localhost:3001/api/v1
- **Swagger docs:** http://localhost:3001/api/docs
- **Web:** http://localhost:3000
- **Mobile:** scan QR code shown in Metro terminal with Expo Go

> See **[docs/SETUP.md](docs/SETUP.md)** for full environment configuration, staging deployment, and production hardening.

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Step-by-step guide for Admins, Drivers, and Employees |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data models, API contract, security, real-time layer |
| [docs/SETUP.md](docs/SETUP.md) | Local dev setup, staging Docker deployment, environment variables, CI/CD |

---

## Key Features

### Authentication
- **Email OTP** — Employees and Admins log in with company email; a 6-digit OTP is emailed (valid 10 min, max 5 attempts)
- **Mobile PIN** — Drivers log in with mobile number + 6-digit PIN; forced change on first login
- **JWT + Refresh Tokens** — Short-lived access tokens (15 min default) with 30-day refresh tokens persisted in `DeviceSession`; full refresh-and-retry on both web and mobile

### Booking Flow (4 Steps — Employee Mobile)
1. **Transport Type** — Person, Person + Material, or Material Only
2. **Pickup, Drop & Time** — Preset locations or custom address; date/time with quick shortcuts (+1h, +2h, +4h, +8h)
3. **Available Vehicles** — Shows fleet-assigned vehicles at the selected pickup location; "No Preference" is always available
4. **Review & Submit** — Full summary before submission

### Fleet Master Assignment
- Admin permanently assigns a driver to a vehicle (fleet-level, separate from booking assignments)
- Driver sets their current location (preset or free-text) from the Fleet tab
- Location drives the "Available Vehicles" screen — only drivers at the pickup location appear
- One-vehicle-per-driver and one-driver-per-vehicle enforced at both DB and service layers

### Trip Execution
- Driver starts trip → odometer logged → GPS pings recorded → driver completes trip → odometer end + fuel log (optional)
- Vehicle status transitions: AVAILABLE → ASSIGNED → IN_TRIP → AVAILABLE
- IN_TRIP guard: vehicle and driver cannot be reassigned while a trip is active

### Approval Modes
- **Manual** — Admin reviews every booking before it enters the assignment queue
- **Auto** — Bookings are immediately approved; preferred-vehicle bookings jump straight to ASSIGNED

### Notifications
- In-app notification when admin assigns a vehicle to a driver
- In-app notification when a booking is auto-assigned to a fleet-assigned driver
- Driver Alerts tab shows all notifications with read/unread state

---

## Booking Lifecycle

```
Employee submits
       │
       ▼
PENDING_APPROVAL ──[reject]──► REJECTED
       │
   [approve]
       │
       ▼
  APPROVED ──────[auto-assign / admin assigns]──► ASSIGNED
       │                                               │
       │                                          [driver accepts]
       │                                               │
       │                                               ▼
       │                                           IN_TRIP
       │                                               │
       │                                         [trip complete]
       │                                               │
       └───────────────────────────────────────► COMPLETED
       │
   [cancel]
       │
       ▼
  CANCELLED
```

---

## Fleet Assignment Lifecycle

```
Admin assigns driver to vehicle (Fleet Master)
              │
              ▼
     Vehicle: ASSIGNED
     Driver: has assignedVehicle
              │
    Driver sets current location
              │
              ▼
      Appears in "Available Vehicles"
      for matching pickup preset
              │
    Booking assigned (auto or admin)
              │
              ▼
     Vehicle: IN_TRIP  (during trip)
              │
       Trip completed
              │
              ▼
     Vehicle: ASSIGNED  (back with driver)
              │
    Admin/Driver unassigns (Fleet Master)
              │
              ▼
     Vehicle: AVAILABLE
```

---

## Contributing

1. Fork and create a feature branch from `develop`
2. Follow the existing module structure (controller → service → DTO → module)
3. Run `pnpm typecheck && pnpm lint` before opening a PR
4. All Prisma schema changes must include a migration file (`pnpm db:migrate:dev --name <description>`)
5. PRs must pass CI (typecheck + lint + build) before merge

---

*Built with the iF Fleet monorepo stack — Turborepo + pnpm + NestJS + React + Expo*
