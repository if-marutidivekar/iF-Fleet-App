# ADR 001 — Authentication Strategy

**Date:** 2026-04-08
**Status:** Accepted

## Context

The platform requires secure access for Employee, Driver, and Admin roles.
Accounts must be restricted to company staff only. Passwords are undesirable
(credential management overhead, phishing risk). The system is internal-only.

## Decision

Use **company-domain email + OTP + employee ID validation** as the login flow.

1. User enters company-domain email (e.g. `@company.com`) — non-company emails are rejected immediately.
2. A 6-digit OTP is generated, hashed, and stored in `otp_records` (TTL: 10 min, max 5 attempts).
3. User enters their **Employee ID** alongside the OTP — both must match for the account to authenticate.
4. On success, issue a short-lived **JWT access token** (15 min) and a **refresh token** (30 days), stored as a hashed `DeviceSession` row.
5. Mobile and web clients attach the access token as `Authorization: Bearer <token>`.
6. The refresh token is used to silently reissue access tokens; server-side revocation is possible by nullifying the session.

## Rationale

- No passwords to store or breach.
- Employee ID as second factor prevents OTP forwarding abuse.
- JWT is stateless for the hot path; revocation is handled via the `DeviceSession` table.
- OTP via company email is already trusted infrastructure.

## Consequences

- Requires a reliable email sender (nodemailer + SMTP or SendGrid).
- OTP records table needs a cleanup worker (run nightly via `worker` app).
- If company email is unavailable (e.g. outage), login is blocked — acceptable for an internal tool.
- `COMPANY_EMAIL_DOMAIN` env var must be set per environment.
