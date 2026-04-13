-- Add DriverAuthMethod enum
CREATE TYPE "DriverAuthMethod" AS ENUM ('EMAIL_OTP', 'MOBILE_PIN');

-- Add new AuditAction values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DRIVER_AUTH_METHOD_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DRIVER_PIN_SET';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DRIVER_PIN_RESET';

-- Add driver PIN / auth fields to users table
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "authMethod"    "DriverAuthMethod" NOT NULL DEFAULT 'EMAIL_OTP',
  ADD COLUMN IF NOT EXISTS "mobileNumber"  TEXT,
  ADD COLUMN IF NOT EXISTS "pinHash"       TEXT,
  ADD COLUMN IF NOT EXISTS "pinHmac"       TEXT,
  ADD COLUMN IF NOT EXISTS "pinMustChange" BOOLEAN NOT NULL DEFAULT false;

-- Unique index on mobileNumber (sparse — only set for MOBILE_PIN drivers)
CREATE UNIQUE INDEX IF NOT EXISTS "users_mobileNumber_key" ON "users"("mobileNumber");

-- Index for PIN login lookups
CREATE INDEX IF NOT EXISTS "users_mobileNumber_idx" ON "users"("mobileNumber");
