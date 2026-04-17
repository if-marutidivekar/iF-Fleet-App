-- Step 31/32/33: Add shared vehicle location fields
-- Vehicle location is now the single source of truth, updated from:
--   - driver location updates (setDriverLocation syncs to vehicle)
--   - trip start (pickup location) and end (dropoff location)
--   - admin manual set (only when vehicle is unassigned and not ASSIGNED/IN_TRIP)

ALTER TABLE "vehicles"
  ADD COLUMN "currentLocationText"     TEXT,
  ADD COLUMN "currentLocationPresetId" TEXT,
  ADD COLUMN "locationUpdatedAt"       TIMESTAMP(3);

-- FK to preset_locations (named relation to avoid Prisma ambiguity)
ALTER TABLE "vehicles"
  ADD CONSTRAINT "vehicles_currentLocationPresetId_fkey"
  FOREIGN KEY ("currentLocationPresetId")
  REFERENCES "preset_locations"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;
