# ADR 003 — Push Notification Strategy

**Date:** 2026-04-08
**Status:** Accepted

## Context

Drivers must be notified of new trip assignments on mobile. Admins need operational alerts.
The mobile app targets both iOS and Android.

## Decision

Use **Expo Notifications** as the cross-platform push abstraction (wraps FCM + APNs).

Flow:
1. On app launch, `registerForPushNotifications()` requests permission and obtains an Expo push token.
2. The token is stored in `DeviceSession.pushToken` via `POST /users/me/push-token`.
3. The `worker` app sends notifications via the **Expo Push API** (`https://exp.host/--/api/v2/push/send`).
4. The backend also writes an `IN_APP` `Notification` row for the in-app notification list.
5. For direct FCM/APNs control (production), swap the Expo Push API call with native SDK — the `DeviceSession.deviceType` (ios/android/web) field supports this.

## Rationale

- Expo Push API handles FCM/APNs routing in one call — ideal for staging and Phase 1.
- Separate `IN_APP` records ensure drivers see missed push notifications when they open the app.
- Staging uses separate FCM credentials (`FCM_SERVER_KEY` env var) from any future production config.

## Consequences

- Requires an Expo account for staging push delivery.
- If driver has denied push permission, the app refreshes assignment status on resume (polling fallback, 30s interval).
- A `NotificationWorker` job in the `worker` app handles delivery, retries, and dead-letter logging.
