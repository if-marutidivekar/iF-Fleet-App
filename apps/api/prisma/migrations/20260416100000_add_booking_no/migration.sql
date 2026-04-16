-- AlterTable: add bookingNo as a unique auto-incrementing integer to bookings
-- A sequence is created to back-fill existing rows and serve new ones.

CREATE SEQUENCE IF NOT EXISTS "bookings_booking_no_seq" AS INTEGER;

ALTER TABLE "bookings"
  ADD COLUMN "bookingNo" INTEGER;

-- Back-fill existing rows with unique sequential values
UPDATE "bookings"
SET "bookingNo" = nextval('"bookings_booking_no_seq"')
WHERE "bookingNo" IS NULL;

-- Set the sequence start to max current value so new rows continue from there
SELECT setval('"bookings_booking_no_seq"', COALESCE(MAX("bookingNo"), 0), true)
FROM "bookings";

-- Now make the column non-nullable with the sequence as default
ALTER TABLE "bookings"
  ALTER COLUMN "bookingNo" SET NOT NULL,
  ALTER COLUMN "bookingNo" SET DEFAULT nextval('"bookings_booking_no_seq"');

-- Own the sequence so it drops with the table
ALTER SEQUENCE "bookings_booking_no_seq" OWNED BY "bookings"."bookingNo";

-- Unique constraint
CREATE UNIQUE INDEX "bookings_booking_no_key" ON "bookings"("bookingNo");
