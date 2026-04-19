# ADR 001 — Authentication Strategy

**Date:** 2026-04-08
**Status:** Accepted

## Context

The platform requires secure access for Employee, Driver, and Admin roles.
Accounts must be restricted to company staff only. Passwords are undesirable
(credential management overhead, phishing risk). The system is internal-only.

## Decision

Two distinct login flows are used, one per role group:

### Email OTP (Employees & Admins)

1. User enters company-domain email (e.g. `@company.com`) — non-company emails are rejected immediately.
2. A 6-digit OTP is generated, hashed, and stored in `otp_records` (TTL: 10 min, max 5 attempts).
3. On success, issue a short-lived **JWT access token** (15 min) and a **refresh token** (30 days), stored as a hashed `DeviceSession` row.
4. Web and mobile clients attach the access token as `Authorization: Bearer <token>`.
5. The refresh token is used to silently reissue access tokens; server-side revocation is possible by nullifying the session.

### Mobile PIN (Drivers — Mobile Only)

1. Driver enters their registered **mobile number**.
2. Server validates the account has `authMethod = MOBILE_PIN`.
3. Driver enters their **6-digit PIN** — verified against a bcrypt hash (`User.pinHash`).
4. A second HMAC-SHA256 hash (`User.pinHmac`) is maintained for PIN uniqueness checks (prevents reuse of previous PINs without exposing the raw PIN to bulk comparisons).
5. On first login (or after admin PIN reset), `pinMustChange = true` forces an immediate PIN change before any other action.
6. On success, issues the same JWT + `DeviceSession` as the OTP flow.

> Drivers log in exclusively with PIN on mobile. The Email OTP tab is not accessible to Driver accounts. Employees and Admins cannot log in with PIN.

## Rationale

- **OTP for Employees/Admins**: No passwords to store or breach. Company email is already trusted infrastructure. The OTP-per-login model requires no credential synchronisation.
- **PIN for Drivers**: Drivers operate mobile-first in field conditions — email OTP is impractical. PIN is fast, works in low-connectivity environments for UI interaction, and PIN complexity rules (no all-same digits, no simple sequences) reduce guessing risk.
- JWT is stateless for the hot path; revocation is handled via the `DeviceSession` table for both auth methods.

## Consequences

- Requires a reliable email sender (nodemailer + SMTP or SendGrid) for Employee/Admin login.
- OTP records table needs a cleanup worker (run nightly via `worker` app).
- If company email is unavailable (e.g. outage), Employee/Admin login is blocked — acceptable for an internal tool.
- `COMPANY_EMAIL_DOMAIN` env var must be set per environment.
- Driver PINs must be provisioned by an Admin (set at driver profile creation) and must comply with complexity rules enforced at both the service layer and the mobile client.
