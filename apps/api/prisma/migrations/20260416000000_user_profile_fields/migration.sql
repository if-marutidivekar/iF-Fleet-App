-- Migration: user_profile_fields
-- Adds userCode (auto-increment), firstName, lastName, department
-- Migrates phone → mobileNumber (where mobileNumber is NULL) and drops phone column

-- 1. Add userCode as a SERIAL (auto-increment) with unique constraint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "userCode" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_userCode_key" ON "users"("userCode");

-- 2. Add new profile fields
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastName"  TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "department" TEXT;

-- 3. Migrate any data from phone → mobileNumber (only where mobileNumber is not already set)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
    UPDATE "users" SET "mobileNumber" = "phone" WHERE "mobileNumber" IS NULL AND "phone" IS NOT NULL;
    ALTER TABLE "users" DROP COLUMN "phone";
  END IF;
END $$;
