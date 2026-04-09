# ADR 004 — Offline Sync Strategy (Driver Mobile)

**Date:** 2026-04-08
**Status:** Accepted

## Context

Drivers operate in low-connectivity environments. The active trip screen, GPS location
tracking, and trip close-out (odometer + fuel) must survive network absence without
corrupting trip state.

## Decision

Use a **local queue + idempotent batch replay** pattern.

### GPS Location Pings
1. Location is captured on a configurable cadence (default: 10s) via `expo-location`.
2. Each ping is immediately sent to `POST /trips/:id/location` when online.
3. If the request fails or device is offline, the ping is written to `AsyncStorage` via `offline-queue.ts`.
4. On network reconnect (NetInfo event), `flushQueue()` batch-uploads all queued pings to `POST /trips/:id/location/batch`.
5. The server de-duplicates by `capturedAt` timestamp — replaying the same batch is safe.

### Trip Close-out (Odometer + Fuel)
1. Values are entered into the UI and persisted to `AsyncStorage` immediately.
2. Submission (`POST /trips/:id/end`) is retried with exponential backoff.
3. The endpoint is idempotent — submitting the same `odometerEnd` twice has no effect.

### Active Trip Screen Offline Mode
1. On trip start, cache booking details, assignment, pickup/dropoff to `AsyncStorage`.
2. The screen reads from cache when offline; API calls are queued.
3. Status changes (start/end/pause) are queued with idempotency keys and flushed on reconnect.

### Map Display
1. Admin/Employee map shows last known position with a stale indicator: `"Last seen X min ago"`.
2. `LocationSource.DELAYED_SYNC` records are visually distinguished from `LIVE` positions.

## Rationale

- AsyncStorage is the standard RN local persistence — no extra dependency.
- `capturedAt` as idempotency key is device-generated and unique per GPS sample.
- Trip state transitions remain server-authoritative; the client never advances state locally.

## Consequences

- Location log volume can be high — server needs an index on `(tripId, capturedAt)` and a retention policy.
- Raw GPS points beyond 90 days should be aggregated or archived (Phase 2 task).
- Battery: `expo-location` background task must be configured carefully to balance accuracy vs. drain.
