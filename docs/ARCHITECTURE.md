# iF Fleet — System Architecture

This document describes the technical architecture of the iF Fleet platform: system topology, data models, API design, authentication, real-time communication, and key design decisions.

---

## Table of Contents

- [System Overview](#system-overview)
- [Monorepo Structure](#monorepo-structure)
- [Backend Architecture (API)](#backend-architecture-api)
- [Database Schema](#database-schema)
- [Authentication & Security](#authentication--security)
- [Frontend Architecture (Web)](#frontend-architecture-web)
- [Mobile Architecture](#mobile-architecture)
- [Shared Domain Package](#shared-domain-package)
- [Real-time Layer](#real-time-layer)
- [Notification System](#notification-system)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [Key Design Decisions](#key-design-decisions)
- [State Machines](#state-machines)
- [API Reference Summary](#api-reference-summary)

---

## System Overview

```
                          ┌──────────────────────────────────────┐
                          │           NGINX (Edge Proxy)          │
                          │   TLS termination · Rate limiting     │
                          └───────────┬──────────────┬────────────┘
                                      │              │
                    ┌─────────────────┘              └──────────────────┐
                    │                                                    │
          ┌─────────▼──────────┐                           ┌────────────▼────────────┐
          │   Web App (React)  │                           │  API (NestJS)            │
          │   Vite · SPA       │◄──── REST + WS ──────────►│  /api/v1/*               │
          │   Port 3000        │                           │  Port 3001               │
          └────────────────────┘                           └───────┬────────┬─────────┘
                                                                   │        │
                          ┌────────────────────┐         ┌─────────▼──┐  ┌──▼──────────┐
                          │  Mobile App (Expo) │         │ PostgreSQL  │  │   Redis      │
                          │  React Native 0.81 │         │ Port 5432   │  │  Port 6379   │
                          │  Expo Router 6     │         └────────────┘  └─────────────┘
                          └──────────┬─────────┘
                                     │
                              REST + WebSocket
                                     │
                               (same NestJS API)
```

**Networks (Docker):**
- `edge` — Nginx ↔ Web App ↔ API (only this network is reachable from the internet)
- `internal` — API ↔ Worker ↔ PostgreSQL ↔ Redis ↔ Grafana ↔ Loki (never exposed)

---

## Monorepo Structure

Managed with **Turborepo** + **pnpm workspaces**. Build tasks cascade from shared packages to apps:

```
packages/domain  ──builds first──►  apps/api
                                    apps/web
                                    apps/mobile
```

**Turborepo task graph (`turbo.json`):**

| Task | Depends On | Cached | Persistent |
|------|-----------|--------|-----------|
| `build` | `^build` (upstream first) | Yes | No |
| `dev` | `^build` | No | Yes |
| `typecheck` | `^typecheck` | Yes | No |
| `lint` | — | Yes | No |
| `test` | `^build` | Yes | No |

Cache inputs include `.env*` files so environment changes invalidate the cache.

---

## Backend Architecture (API)

### Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | NestJS 10 (TypeScript) |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Cache | Redis 7 |
| Auth | Passport + JWT (`@nestjs/passport`, `passport-jwt`) |
| Real-time | Socket.io 4 (`@nestjs/platform-socket.io`) |
| Email | Nodemailer |
| Validation | `class-validator` + `class-transformer` via global `ValidationPipe` |
| API Versioning | URI-based (`/api/v1`) |
| Documentation | Swagger (`@nestjs/swagger`) at `/api/docs` |

### Module Map

```
src/
├── app.module.ts              # Root module
├── modules/
│   ├── auth/                  # OTP + PIN auth, JWT strategy, session management
│   ├── users/                 # User CRUD, profile completion
│   ├── fleet/                 # Vehicles, drivers, fleet-level assignment, locations
│   ├── bookings/              # Booking CRUD, approval, cancellation
│   ├── assignments/           # Booking↔driver↔vehicle assignment, accept/decline
│   ├── trips/                 # Trip start/end, odometer, fuel logs
│   ├── tracking/              # GPS location pings, location log storage
│   ├── notifications/         # In-app, push, email notifications; list + mark-read
│   ├── admin/                 # App config (approval mode, etc.), reporting
│   ├── reporting/             # Trip history, fuel, utilisation reports
│   └── mail/                  # Nodemailer wrapper (SMTP)
└── common/
    ├── prisma/                # PrismaService (singleton)
    ├── guards/                # JwtAuthGuard, RolesGuard
    ├── decorators/            # @CurrentUser(), @Roles()
    ├── health/                # GET /health (Docker readiness probe)
    └── utils/                 # PIN complexity validator
```

### Request Lifecycle

```
Request
  │
  ├─► Helmet (security headers)
  ├─► CORS (origin allowlist from env)
  ├─► JWT AuthGuard (validates Bearer token, injects user into req)
  ├─► RolesGuard (checks @Roles() decorator against req.user.role)
  ├─► ValidationPipe (whitelist, forbidNonWhitelisted, transform)
  ├─► Controller method
  ├─► Service (business logic + Prisma queries)
  └─► Response JSON
```

### API Versioning & Base Path

All endpoints: `POST/GET/PATCH/DELETE /api/v1/<resource>`

---

## Database Schema

### Entity Relationship Overview

```
User ──(1:1)──► DriverProfile ──(1:1)──► Vehicle (fleet-assigned)
 │
 └──(1:N)──► Booking ──(1:1)──► Assignment ──(1:1)──► Trip
                │                    │                   │
                │                    ├──► Vehicle         ├──► LocationLog (N)
                │                    └──► DriverProfile   └──► FuelLog (N)
                │
                ├──► PresetLocation (pickup)
                └──► PresetLocation (dropoff)

User ──(1:N)──► Notification
User ──(1:N)──► AuditLog
User ──(1:N)──► DeviceSession (refresh tokens)
```

### Core Models

#### User
```
id            String (cuid)      Primary key
userCode      Int (auto)         Sequential display number
employeeId    String?            Company employee ID
firstName     String?
lastName      String?
name          String             Display name (derived)
email         String (unique)    Company email
department    String?
role          UserRole           EMPLOYEE | DRIVER | ADMIN
status        UserStatus         ACTIVE | INACTIVE | SUSPENDED
authMethod    DriverAuthMethod   EMAIL_OTP | MOBILE_PIN
mobileNumber  String?            Required for PIN drivers
pinHash       String?            bcrypt hash of PIN
pinMustChange Boolean            Force PIN change on next login
deletedAt     DateTime?          Soft delete
```

#### Vehicle
```
id                      String
vehicleNo               String (unique)   Registration number
type                    VehicleType       SEDAN | SUV | VAN | TRUCK | BUS
make                    String?
model                   String?
year                    Int?
capacity                Int               Passenger/cargo capacity
ownership               VehicleOwnership  OWNED | LEASED | HIRED
status                  VehicleStatus     AVAILABLE | ASSIGNED | IN_TRIP | MAINTENANCE | INACTIVE
maintenanceDueAt        DateTime?
currentDriverId         String?           FK → DriverProfile (fleet-level assignment)
currentDriverAssignedAt DateTime?
currentLocationText     String?           Current location — free-text address (single source of truth)
currentLocationPresetId String?           FK → PresetLocation (named relation "VehicleCurrentLocation")
locationUpdatedAt       DateTime?         When the vehicle's location was last updated
deletedAt               DateTime?         Soft delete
```

> **Vehicle is the location source of truth.** All writes to location (driver updates their location,
> trip start sets pickup, trip end sets dropoff, admin manual set) target the Vehicle's own fields.
> Consumer code reads `Vehicle.currentLocationText` / `Vehicle.currentLocationPreset` directly.

#### DriverProfile
```
id                      String
userId                  String (unique)   FK → User
licenseNumber           String
licenseExpiry           DateTime
shiftReady              Boolean           Must be true for assignments
currentLocationText     String?           Driver's stated location (synced to Vehicle on update)
currentLocationPresetId String?           FK → PresetLocation
locationUpdatedAt       DateTime?         When location was last set
deletedAt               DateTime?
```

> **Driver location syncs to Vehicle.** When a driver calls `PATCH /fleet/drivers/my-location`,
> the API writes both the `DriverProfile` and the driver's currently assigned `Vehicle` with the
> same location values. The Vehicle copy is the authoritative source used by all consumers.

#### Booking
```
id                  String
bookingNo           Int (auto)         Sequential display number
requesterId         String             FK → User
transportType       TransportType      PERSON | PERSON_WITH_MATERIAL | MATERIAL_ONLY
passengerCount      Int?
materialDescription String?
pickupPresetId      String?            FK → PresetLocation
pickupCustomAddress String?
pickupLabel         String?            Resolved display label
dropoffPresetId     String?
dropoffCustomAddress String?
dropoffLabel        String?
requestedAt         DateTime           Requested departure time
status              BookingStatus
approvedById        String?            FK → User (admin)
approvalNote        String?
rejectionReason     String?
preferredVehicleId  String?            FK → Vehicle (employee preference)
createdAt           DateTime
```

#### Assignment
```
id           String
bookingId    String (unique)    FK → Booking (one assignment per booking)
vehicleId    String             FK → Vehicle
driverId     String             FK → DriverProfile
assignedById String             FK → User (admin or self for auto-assign)
assignedAt   DateTime
decision     AssignmentDecision PENDING | ACCEPTED | DECLINED
decisionAt   DateTime?
declineReason String?
```

#### Trip
```
id            String
bookingId     String (unique)   FK → Booking
assignmentId  String (unique)   FK → Assignment
status        TripStatus        CREATED | STARTED | IN_PROGRESS | PAUSED | COMPLETED | CANCELLED | EXCEPTION
odometerStart Int?
odometerEnd   Int?
actualStartAt DateTime?
actualEndAt   DateTime?
remarks       String?
```

#### DeviceSession (Refresh Tokens)
```
id            String
userId        String            FK → User
refreshToken  String (unique)   bcrypt hash of raw token
pushToken     String?           FCM / APNs push token
deviceType    String?           ios | android | web
lastActiveAt  DateTime
revokedAt     DateTime?         Set on logout
```

#### AppConfig
```
key      String (PK)   e.g., "booking.approvalMode"
value    Json          e.g., "AUTO" or "MANUAL"
updatedAt DateTime
```

### Indexes

Key indexes for performance:
- `Booking.requesterId`, `Booking.status`
- `Assignment.bookingId` (unique), `Assignment.driverId`
- `Trip.bookingId` (unique), `Trip.status`
- `LocationLog.tripId`, `LocationLog.capturedAt`
- `Notification.recipientId`, `Notification.deliveryState`
- `DeviceSession.userId`, `DeviceSession.refreshToken` (unique)
- `OtpRecord.[email, used]`

---

## Authentication & Security

### Email OTP Flow

```
Client                              API                         Email Server
  │                                  │                               │
  │  POST /auth/request-otp          │                               │
  │  { email }                       │                               │
  │─────────────────────────────────►│                               │
  │                                  │  validate company domain      │
  │                                  │  check account status         │
  │                                  │  generate 6-digit OTP         │
  │                                  │  bcrypt hash → OtpRecord      │
  │                                  │────────────────────────────── ►│
  │                                  │  sendMail(to, subject, code)  │
  │◄─────────────────────────────────│                               │
  │  200 OK                          │                               │
  │                                  │                               │
  │  POST /auth/verify-otp           │                               │
  │  { email, otp }                  │                               │
  │─────────────────────────────────►│                               │
  │                                  │  find OtpRecord               │
  │                                  │  check attempts ≤ 5           │
  │                                  │  check expiry (10 min)        │
  │                                  │  bcrypt compare               │
  │                                  │  mark OtpRecord.used = true   │
  │                                  │  issue accessToken (JWT)      │
  │                                  │  issue refreshToken           │
  │                                  │  create DeviceSession         │
  │◄─────────────────────────────────│                               │
  │  { accessToken, refreshToken,    │                               │
  │    user }                        │                               │
```

### PIN Flow (Drivers)

```
Client                              API
  │  POST /auth/driver/request-pin-login
  │  { mobileNumber }
  │─────────────────────────────────►│
  │                                  │  find user by mobileNumber
  │                                  │  validate MOBILE_PIN authMethod
  │◄─────────────────────────────────│
  │  200 OK                          │
  │                                  │
  │  POST /auth/driver/verify-pin    │
  │  { mobileNumber, pin }           │
  │─────────────────────────────────►│
  │                                  │  bcrypt compare pinHash
  │                                  │  check pinMustChange flag
  │                                  │  issue tokens + DeviceSession
  │◄─────────────────────────────────│
  │  { accessToken, refreshToken,    │
  │    pinMustChange, user }         │
```

### Token Refresh Flow

```
Client                                API
  │  (accessToken expired → 401)       │
  │                                    │
  │  POST /auth/refresh                │
  │  { refreshToken }                  │
  │───────────────────────────────────►│
  │                                    │  hash incoming token
  │                                    │  find DeviceSession (not revoked)
  │                                    │  validate user status
  │                                    │  issue new accessToken
  │◄───────────────────────────────────│
  │  { accessToken }                   │
  │                                    │
  │  Retry original request with       │
  │  new accessToken                   │
```

**Mobile refresh interceptor** queues all concurrent 401 requests and replays them after a single refresh — preventing multiple simultaneous refresh calls.

### JWT Strategy

```typescript
// JWT payload
{ id: string, email: string, role: UserRole }

// Injected as req.user via @CurrentUser() decorator
// Access via: const user = req.user as JwtUser
```

### Security Headers (Helmet)

- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Strict-Transport-Security (HSTS)
- Referrer-Policy

### Input Validation

Global `ValidationPipe` with:
- `whitelist: true` — strips unknown properties
- `forbidNonWhitelisted: true` — rejects unknown properties with 400
- `transform: true` — coerces query params to declared types

---

## Frontend Architecture (Web)

### Technology

- **React 18** + TypeScript 5 + **Vite 5** (dev server + bundler)
- **React Router v6** — declarative routing with role-based guards
- **TanStack Query v5** — server state, caching, background refetch
- **Zustand 4** — client state (auth only)
- **Axios** — HTTP client with request/response interceptors

### Route Structure

```
/                      → redirect based on role
/login                 → public (LoginPage)
/complete-profile      → semi-public (CompleteProfilePage)

/employee/             → EmployeeDashboard
/employee/book         → NewBookingPage
/employee/history      → BookingHistoryPage
/employee/track/:id    → TripTrackingPage

/driver/               → DriverDashboard
/driver/fleet          → FleetPage
/driver/trip/:id       → ActiveTripPage
/driver/profile        → ProfilePage

/admin/                → AdminDashboard
/admin/bookings        → BookingQueuePage
/admin/map             → FleetMapPage
/admin/fleet           → FleetMasterPage
/admin/users           → UsersPage
/admin/reports         → ReportsPage
/admin/settings        → SettingsPage
```

### API Client (`src/lib/api.ts`)

```typescript
// Request interceptor: attach Bearer token from Zustand store
// Response interceptor: 401 → attempt refresh → retry → logout on failure
// Refresh queue: prevents concurrent refresh races
```

### Auth Store (`src/stores/auth.store.ts`)

```typescript
{
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null        // persisted in localStorage
  setAuth(user, accessToken, refreshToken): void
  setAccessToken(token): void
  clearAuth(): void
  isAuthenticated(): boolean
}
```

### Data Fetching Pattern

```typescript
// All server data via React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['bookings'],
  queryFn: () => api.get('/bookings').then(r => r.data),
  staleTime: 30_000,
})

// Mutations with cache invalidation
const mutation = useMutation({
  mutationFn: (id) => api.patch(`/bookings/${id}/approve`),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
})
```

---

## Mobile Architecture

### Technology

- **React Native 0.81** + TypeScript 5 + **Expo SDK 54**
- **Expo Router 6** — file-system based routing with typed navigation
- **TanStack Query v5** — server state
- **Zustand 4** + AsyncStorage persistence — auth state
- **Axios** — HTTP client with refresh interceptor (mirrors web)
- **expo-location** — GPS coordinates
- **expo-notifications** — push notification registration
- **expo-task-manager** — background location tasks
- **socket.io-client** — real-time updates

### Route Groups (Expo Router)

```
app/
├── _layout.tsx             # Root: QueryClientProvider, SafeAreaProvider
├── index.tsx               # Role redirect (→ admin/driver/employee group)
├── (auth)/
│   ├── login.tsx           # OTP + PIN login tabs
│   └── complete-profile.tsx
├── (admin)/
│   ├── _layout.tsx         # Bottom tabs: Home, Book, Fleet, Track, History, Admin, Profile
│   ├── index.tsx           # Admin home dashboard
│   ├── book.tsx            # Booking approval queue
│   ├── fleet.tsx           # Fleet Master (vehicles + drivers)
│   ├── track.tsx           # Live fleet map
│   ├── history.tsx         # Booking + trip history
│   ├── admin.tsx           # App settings
│   └── profile.tsx
├── (driver)/
│   ├── _layout.tsx         # Bottom tabs: Home, Fleet, Track, History, Alerts, Profile
│   ├── index.tsx           # Active assignment cards
│   ├── fleet.tsx           # My vehicle + set location
│   ├── track.tsx           # Active trip controls
│   ├── history.tsx
│   ├── alerts.tsx          # In-app notifications
│   └── profile.tsx
└── (employee)/
    ├── _layout.tsx         # Bottom tabs: Home, Book, Track, History, Profile
    ├── index.tsx           # My bookings
    ├── new-booking.tsx     # 4-step booking wizard
    ├── track.tsx           # Active booking tracker
    ├── history.tsx
    └── profile.tsx
```

### Auth Store (Mobile)

```typescript
// apps/mobile/stores/auth.store.ts
{
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null        // persisted in AsyncStorage
  setAuth(user, accessToken, refreshToken): void
  setAccessToken(token): void
  clearAuth(): void
  isAuthenticated(): boolean
}
```

### Mobile API Client (`lib/api.ts`)

Mirrors the web pattern:
1. **Request interceptor**: reads `accessToken` from Zustand → sets `Authorization: Bearer <token>`
2. **Response interceptor (401 handler)**:
   - No refresh token → `clearAuth()` + `router.replace('/(auth)/login')`
   - Refresh in progress → queue request, await new token
   - Otherwise → POST `/auth/refresh`, update `accessToken`, replay queued requests
   - Refresh fails → `clearAuth()` + redirect to login

---

## Shared Domain Package

`packages/domain` is a TypeScript-only package compiled to both ESM and CJS, imported by all three apps.

### Contents

**`enums.ts`** — All platform enums:
- `UserRole`, `UserStatus`
- `VehicleStatus`, `VehicleType`, `VehicleOwnership`
- `BookingStatus`, `TransportType`
- `AssignmentDecision`
- `TripStatus`, `LocationSource`
- `NotificationChannel`, `NotificationDeliveryState`

**`entities.ts`** — Core TypeScript interfaces (User, Vehicle, Booking, Assignment, Trip, etc.)

**`state-machines.ts`** — Allowed status transition maps (used by services for validation)

---

## Real-time Layer

Socket.io runs within the same NestJS process (no separate process needed at MVP scale).

### Events

| Event (Server → Client) | Payload | Consumer |
|------------------------|---------|---------|
| `trip:location` | `{ tripId, lat, lng, timestamp }` | Admin (map), Employee (track) |
| `trip:status` | `{ tripId, status }` | Employee, Admin |
| `assignment:created` | `{ assignment }` | Driver (home tab) |
| `notification:new` | `{ notification }` | All (badge update) |

### Rooms

- `admin` — all connected admin sockets
- `user:{userId}` — per-user room for personal events
- `trip:{tripId}` — live location updates for a specific trip

### Connection Auth

Socket.io handshake must include the JWT access token:

```javascript
const socket = io(API_URL, {
  auth: { token: accessToken }
})
```

---

## Notification System

### Channels

| Channel | Trigger | Delivery |
|---------|---------|---------|
| IN_APP | Driver assigned to vehicle | Stored in DB, fetched via `GET /notifications` |
| IN_APP | Booking auto-assigned to driver | Stored in DB |
| PUSH | New assignment (FCM/APNs) | Via Firebase / Apple Push |
| EMAIL | OTP codes | Nodemailer SMTP |

### In-App Notification Lifecycle

```
Created (deliveryState: SENT)
    │
    │  User reads notification
    ▼
deliveryState: READ, readAt: <timestamp>
```

### API

```
GET  /api/v1/notifications        # Current user's notifications (limit 50, desc)
PATCH /api/v1/notifications/:id/read  # Mark single notification as read
```

---

## Infrastructure & Deployment

### Docker Services

| Service | Image | Network | Notes |
|---------|-------|---------|-------|
| nginx | nginx:1.27-alpine | edge | TLS, reverse proxy |
| web-app | if-fleet-web:tag | edge | React SPA static |
| api | if-fleet-api:tag | edge + internal | NestJS |
| worker | if-fleet-worker:tag | internal | Background jobs |
| postgres | postgres:16-alpine | internal | Primary database |
| redis | redis:7-alpine | internal | Session cache |
| loki | grafana/loki:3.0 | internal | Log aggregation |
| grafana | grafana:11.0 | internal | Dashboards (via nginx) |
| minio | minio/minio | internal | Optional S3 storage |

### Dockerfile Strategy (Multi-stage)

**`Dockerfile.api`:**
```
Stage 1 (builder): node:20-alpine
  - Install all deps
  - pnpm build (tsc → dist/)
  - pnpm prisma generate

Stage 2 (runner): node:20-alpine
  - Copy dist/ + node_modules (production only)
  - ENTRYPOINT: node dist/main.js
```

**`Dockerfile.web`:**
```
Stage 1 (builder): node:20-alpine
  - Install + pnpm build (vite build → dist/)

Stage 2 (runner): nginx:alpine
  - Copy dist/ to /usr/share/nginx/html
  - nginx.conf serves SPA (fallback to index.html)
```

### Nginx Configuration

```nginx
# Route to web app
location / { proxy_pass http://web-app:3000; }

# Route to API
location /api/ { proxy_pass http://api:3001; }

# WebSocket upgrade for Socket.io
location /socket.io/ {
  proxy_pass http://api:3001;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
}

# Grafana
location /grafana/ { proxy_pass http://grafana:3000; }
```

### Health Checks

- API: `GET /api/v1/health` → 200 (Prisma ping + Redis ping)
- Web: `curl http://localhost:3000` → 200
- Postgres: `pg_isready -U fleet_user -d fleet_db`
- Redis: `redis-cli ping` → PONG

---

## Key Design Decisions

### 1. Fleet-Level vs Booking-Level Assignment

Two independent assignment layers exist:

- **Fleet-level**: Admin assigns a driver to a vehicle persistently (`Vehicle.currentDriverId`). This represents the standing/shift assignment. The driver owns that vehicle until explicitly unassigned.
- **Booking-level**: An `Assignment` record links a specific booking to a vehicle and driver. Created by admin or auto-generated when an employee selects a preferred vehicle.

**One Source of Truth rule**: If a vehicle has a fleet-assigned driver, all booking assignments for that vehicle must use the same driver. Violations are rejected with a 409 Conflict at the service layer.

### 2. Preferred Vehicle Flow

When an employee selects a preferred vehicle at booking time:
1. The `Booking.preferredVehicleId` is stored.
2. `tryAutoAssign()` is called immediately — if the vehicle has a current fleet driver, an `Assignment` is created with `decision: PENDING` and the driver is notified.
3. In **Auto** mode: booking goes straight to ASSIGNED.
4. In **Manual** mode: booking stays PENDING_APPROVAL; when admin approves, they detect the existing assignment and the booking jumps directly to ASSIGNED (skipping APPROVED).

### 3. Vehicle Status as Single Source of Truth

`Vehicle.status` is the canonical source for vehicle availability:
- `AVAILABLE` → can be fleet-assigned or booking-assigned
- `ASSIGNED` → fleet or booking assignment exists (but no active trip)
- `IN_TRIP` → active trip in progress; all reassignment blocked
- `MAINTENANCE` / `INACTIVE` → operationally blocked

### 4. Approval Mode as AppConfig

Approval mode is stored in `AppConfig { key: 'booking.approvalMode', value: 'MANUAL' | 'AUTO' }`. This allows runtime switching without code deployment.

### 5. Vehicle Location as Single Source of Truth

The `Vehicle` model owns the canonical current location of each vehicle via three fields:
`currentLocationText`, `currentLocationPresetId`, and `locationUpdatedAt`.

Every location-changing event writes to the Vehicle directly:

| Event | Who writes | Fields updated |
|-------|-----------|----------------|
| Driver sets location (`PATCH /fleet/drivers/my-location`) | `fleet.service` | Vehicle + DriverProfile |
| Trip start | `trips.service` | Vehicle (`currentLocationPresetId` = booking pickup) |
| Trip end | `trips.service` | Vehicle (`currentLocationPresetId` = booking dropoff) |
| Admin manual set (`PATCH /fleet/vehicles/:id/location`) | `fleet.service` | Vehicle only |

**Admin manual set rules:** Only allowed when the vehicle has `currentDriverId = null` AND status is not `ASSIGNED` or `IN_TRIP`. When a driver is assigned, the driver's own location updates are the authoritative write path.

All consumers (Fleet Master table, Available Vehicles screen, assignment dropdown) read from `Vehicle.currentLocationText` / `Vehicle.currentLocationPreset` directly — never from the driver's copy.

### 6. No GPS Simulation at MVP

Live GPS tracking uses `expo-location` on mobile. The `LocationSource` enum includes `SIMULATED` for future testing, but only `LIVE` and `DELAYED_SYNC` are produced at runtime. Driver location for the "Available Vehicles" feature is a manually set field (`currentLocationText` / `currentLocationPresetId`), not live GPS.

### 7. PIN Security (Dual Hash)

Driver PINs use two hashes:
- **bcrypt** (`pinHash`) — for authentication (timing-safe comparison)
- **HMAC-SHA256** (`pinHmac`) — for uniqueness checks only (to prevent PIN reuse without exposing the raw PIN to bcrypt comparisons during bulk checks)

### 8. Fleet Assignment Preservation on Cancellation

When a booking is cancelled, declined, or a driver cancels an accepted assignment, the vehicle's status is only reset to `AVAILABLE` if the vehicle has **no fleet-assigned driver** (`currentDriverId = null`). If a fleet driver is assigned, the vehicle stays `ASSIGNED` — the booking lifecycle does not affect the standing fleet assignment.

This is enforced in `bookings.service`, `assignments.service` (decline + driverCancel), and any reassign path.

### 9. Past Datetime Validation

Booking `requestedAt` is validated against the current server time with a 60-second grace window to account for client clock skew:

```typescript
if (requestedAt.getTime() < Date.now() - 60_000) {
  throw new BadRequestException('Booking date/time cannot be in the past.');
}
```

The same check is mirrored on the mobile client (`new-booking.tsx`) to give instant feedback before the request is sent.

### 10. Soft Deletes

`User`, `DriverProfile`, and `Vehicle` support soft deletes (`deletedAt DateTime?`). All queries filter `where: { deletedAt: null }`. Historical records (bookings, assignments, trips, audit logs) reference the original IDs and remain intact.

### 11. Refresh Token Security

Refresh tokens are stored as bcrypt hashes in `DeviceSession`. The raw token is only ever held by the client. On logout, the session is revoked by setting `revokedAt`. On refresh, the hash is looked up and the `revokedAt` check prevents use of revoked tokens.

---

## State Machines

### Booking Status Transitions

```
DRAFT ──────────────────────────────────────────────── (not used in MVP)
PENDING_APPROVAL ──[approve]──► APPROVED ──[assign]──► ASSIGNED ──[trip start]──► IN_TRIP ──[complete]──► COMPLETED
PENDING_APPROVAL ──[reject]──► REJECTED
PENDING_APPROVAL ──[cancel]──► CANCELLED
APPROVED         ──[cancel]──► CANCELLED
ASSIGNED         ──[cancel]──► CANCELLED
(auto-approve + preferred vehicle skips PENDING_APPROVAL → goes directly APPROVED → ASSIGNED)
(manual-approve + preferred vehicle: PENDING_APPROVAL → ASSIGNED, skipping APPROVED)
```

### Vehicle Status Transitions

```
AVAILABLE ──[fleet assign / booking assign]──────────────────────────► ASSIGNED
ASSIGNED  ──[trip start]─────────────────────────────────────────────► IN_TRIP
IN_TRIP   ──[trip complete]──────────────────────────────────────────► ASSIGNED
ASSIGNED  ──[fleet unassign]─────────────────────────────────────────► AVAILABLE
ASSIGNED  ──[booking cancel/decline, no fleet driver]────────────────► AVAILABLE
ASSIGNED  ──[booking cancel/decline, fleet driver still assigned]─────► ASSIGNED (unchanged)
AVAILABLE ──[maintenance flag]───────────────────────────────────────► MAINTENANCE
MAINTENANCE ──[maintenance clear]────────────────────────────────────► AVAILABLE
ANY       ──[admin deactivate]───────────────────────────────────────► INACTIVE
```

> Booking-lifecycle events (cancel, decline, driver cancel) do **not** revert a vehicle to `AVAILABLE` if it has a standing fleet driver. The fleet assignment is independent of the booking assignment.

### Assignment Decision Transitions

```
PENDING ──[driver accepts]──► ACCEPTED
PENDING ──[driver declines]─► DECLINED
ACCEPTED ──[driver cancels]─► DECLINED  (with cancelReason)
(DECLINED booking stays ASSIGNED so admin can Reassign)
```

### Trip Status Transitions

```
CREATED ──[driver starts]──► STARTED / IN_PROGRESS
IN_PROGRESS ──[pause]──────► PAUSED
PAUSED ──[resume]──────────► IN_PROGRESS
IN_PROGRESS ──[complete]───► COMPLETED
IN_PROGRESS ──[exception]──► EXCEPTION
```

---

## API Reference Summary

Full interactive docs available at `/api/docs` (Swagger UI, disabled in production).

### Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/request-otp` | None | Send OTP to company email |
| POST | `/auth/verify-otp` | None | Verify OTP → tokens |
| POST | `/auth/driver/request-pin-login` | None | Initiate PIN login |
| POST | `/auth/driver/verify-pin` | None | Verify PIN → tokens |
| POST | `/auth/driver/change-pin` | JWT | Change PIN |
| POST | `/auth/refresh` | None | Refresh access token |
| POST | `/auth/logout` | JWT | Revoke refresh token |

### Fleet

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/fleet/vehicles` | Admin | List all vehicles |
| POST | `/fleet/vehicles` | Admin | Create vehicle |
| PATCH | `/fleet/vehicles/:id` | Admin | Update vehicle |
| PATCH | `/fleet/vehicles/:id/assign-driver` | Admin | Fleet-assign driver to vehicle |
| PATCH | `/fleet/vehicles/:id/unassign-driver` | Admin/Driver | Remove fleet driver assignment |
| PATCH | `/fleet/vehicles/:id/location` | Admin | Set vehicle location (only when no fleet driver + not ASSIGNED/IN_TRIP) |
| GET | `/fleet/vehicles/available-with-driver` | Any | Vehicles with driver at pickup location |
| GET | `/fleet/vehicles/available` | Driver | AVAILABLE vehicles (for self-assign) |
| GET | `/fleet/vehicles/for-assignment` | Admin | AVAILABLE + non-conflicting ASSIGNED vehicles; accepts `?pickupPresetId` filter |
| POST | `/fleet/vehicles/:id/self-assign` | Driver | Driver self-assigns a vehicle |
| GET | `/fleet/drivers` | Admin | List all driver profiles |
| POST | `/fleet/drivers` | Admin | Create driver profile |
| PATCH | `/fleet/drivers/:id` | Admin | Update driver profile |
| GET | `/fleet/drivers/me` | Driver | My driver profile + assigned vehicle |
| PATCH | `/fleet/drivers/my-location` | Driver | Set current location |
| GET | `/fleet/locations` | Any | List preset locations |
| POST | `/fleet/locations` | Admin | Create preset location |
| PATCH | `/fleet/locations/:id` | Admin | Update preset location |

### Bookings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/bookings` | Any | Create booking |
| GET | `/bookings` | Any | List bookings (role-filtered) |
| GET | `/bookings/:id` | Any | Get booking detail |
| PATCH | `/bookings/:id/approve` | Admin | Approve booking |
| PATCH | `/bookings/:id/reject` | Admin | Reject booking |
| PATCH | `/bookings/:id/cancel` | Any | Cancel booking |

### Assignments

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/assignments` | Admin | Create assignment |
| GET | `/assignments` | Admin/Driver | List assignments |
| GET | `/assignments/:id` | Admin/Driver | Get assignment |
| PATCH | `/assignments/:id/accept` | Driver | Accept assignment |
| PATCH | `/assignments/:id/decline` | Driver | Decline assignment |
| PATCH | `/assignments/:id/cancel` | Driver | Cancel accepted assignment |
| PATCH | `/assignments/:id/reassign` | Admin | Reassign to new vehicle/driver |
| GET | `/assignments/available` | Driver | Available (unassigned) bookings |
| POST | `/assignments/self-assign` | Driver | Driver self-assigns booking |

### Trips

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/trips/:id/start` | Driver | Start trip (odometer) |
| POST | `/trips/:id/end` | Driver | End trip (odometer + remarks) |
| POST | `/trips/:id/fuel-log` | Driver | Add fuel log entry |
| GET | `/trips` | Admin/Driver | List trips |
| GET | `/trips/:id` | Admin/Driver | Get trip detail |

### Notifications

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/notifications` | Any | Get my notifications (limit 50) |
| PATCH | `/notifications/:id/read` | Any | Mark notification as read |

### Admin

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/config` | Admin | Get all app config |
| PUT | `/admin/config/approval-mode` | Admin | Set approval mode |
| PUT | `/admin/config/session-timeout` | Admin | Set session timeout |
