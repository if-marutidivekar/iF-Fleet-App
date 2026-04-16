-- AlterTable: Vehicle — add fleet-level driver assignment fields
ALTER TABLE "vehicles" ADD COLUMN "currentDriverId" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "currentDriverAssignedAt" TIMESTAMP(3);

-- AlterTable: DriverProfile — add manual location fields
ALTER TABLE "driver_profiles" ADD COLUMN "currentLocationText" TEXT;
ALTER TABLE "driver_profiles" ADD COLUMN "currentLocationPresetId" TEXT;
ALTER TABLE "driver_profiles" ADD COLUMN "locationUpdatedAt" TIMESTAMP(3);

-- AlterTable: Booking — add preferred vehicle field
ALTER TABLE "bookings" ADD COLUMN "preferredVehicleId" TEXT;

-- CreateIndex: unique constraint so one driver can only be in one vehicle at a time
CREATE UNIQUE INDEX "vehicles_currentDriverId_key" ON "vehicles"("currentDriverId");

-- AddForeignKey: Vehicle.currentDriverId → driver_profiles.id
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_currentDriverId_fkey"
  FOREIGN KEY ("currentDriverId") REFERENCES "driver_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: DriverProfile.currentLocationPresetId → preset_locations.id
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_currentLocationPresetId_fkey"
  FOREIGN KEY ("currentLocationPresetId") REFERENCES "preset_locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Booking.preferredVehicleId → vehicles.id
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_preferredVehicleId_fkey"
  FOREIGN KEY ("preferredVehicleId") REFERENCES "vehicles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
