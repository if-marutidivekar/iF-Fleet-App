import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { StartTripDto } from './dto/start-trip.dto';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { AddFuelLogDto } from './dto/add-fuel-log.dto';
import { LogLocationDto } from './dto/log-location.dto';
import { UserRole } from '@if-fleet/domain';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  private tripInclude = {
    assignment: {
      include: {
        booking: {
          include: {
            requester: { select: { id: true, name: true, email: true, mobileNumber: true } },
            pickupPreset: { select: { id: true, name: true, address: true } },
            dropoffPreset: { select: { id: true, name: true, address: true } },
          },
        },
        vehicle: { select: { id: true, vehicleNo: true, type: true, make: true, model: true } },
        driver: {
          include: {
            user: { select: { id: true, name: true, mobileNumber: true } },
          },
        },
      },
    },
    locationLogs: {
      orderBy: { capturedAt: 'desc' as const },
      take: 50,
    },
    fuelLogs: true,
  } as const;

  async startTrip(assignmentId: string, dto: StartTripDto, userId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        driver: true,
        booking: {
          select: {
            pickupPresetId: true,
            pickupCustomAddress: true,
            pickupLabel: true,
          },
        },
        trip: true,
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');
    if (assignment.trip) throw new BadRequestException('Trip already started for this assignment');

    // Verify driver
    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile || assignment.driverId !== driverProfile.id) {
      throw new ForbiddenException('Only the assigned driver can start the trip');
    }

    if (assignment.decision !== 'ACCEPTED') {
      throw new BadRequestException('Assignment must be accepted before starting trip');
    }

    const trip = await this.prisma.trip.create({
      data: {
        bookingId: assignment.bookingId,
        assignmentId: assignment.id,
        status: 'STARTED',
        odometerStart: dto.odometerStart ?? null,
        actualStartAt: new Date(),
      },
      include: this.tripInclude,
    });

    // Step 31/33: Update vehicle location to pickup when trip starts.
    // Also update driver's location so both sources stay in sync.
    const { booking } = assignment;
    const pickupLocationText = booking.pickupLabel ?? booking.pickupCustomAddress ?? null;
    const pickupPresetId = booking.pickupPresetId ?? null;

    const vehicleUpdateData: Record<string, unknown> = { status: 'IN_TRIP' };
    if (pickupLocationText) {
      vehicleUpdateData['currentLocationText'] = pickupLocationText;
      vehicleUpdateData['currentLocationPresetId'] = pickupPresetId;
      vehicleUpdateData['locationUpdatedAt'] = new Date();
    }

    await Promise.all([
      this.prisma.vehicle.update({
        where: { id: assignment.vehicleId },
        data: vehicleUpdateData,
      }),
      this.prisma.booking.update({
        where: { id: assignment.bookingId },
        data: { status: 'IN_TRIP' },
      }),
      // Sync driver profile location to pickup as well
      pickupLocationText
        ? this.prisma.driverProfile.update({
            where: { id: assignment.driverId },
            data: {
              currentLocationText: pickupLocationText,
              currentLocationPresetId: pickupPresetId,
              locationUpdatedAt: new Date(),
            },
          })
        : Promise.resolve(),
    ]);

    return trip;
  }

  async completeTrip(id: string, dto: CompleteTripDto, userId: string, userRole?: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        assignment: {
          include: {
            driver: true,
            vehicle: true,                  // needed for currentDriverId check
            booking: {                      // Step 19: need dropoff location
              select: {
                dropoffPresetId: true,
                dropoffCustomAddress: true,
                dropoffLabel: true,
              },
            },
          },
        },
      },
    });

    if (!trip) throw new NotFoundException('Trip not found');

    if (userRole !== 'ADMIN') {
      const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
      if (!driverProfile || trip.assignment.driverId !== driverProfile.id) {
        throw new ForbiddenException('Only the assigned driver or admin can complete the trip');
      }
    }

    if (trip.status !== 'STARTED' && trip.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Trip is not in a started state');
    }

    const completedTrip = await this.prisma.trip.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        odometerEnd: dto.odometerEnd ?? null,
        remarks: dto.remarks ?? null,
        actualEndAt: new Date(),
      },
      include: this.tripInclude,
    });

    // Step 19: Resolve the dropoff location from the completed booking.
    // dropoffLabel is the canonical display name (preset name or custom address label).
    const { booking } = trip.assignment;
    const dropoffLocationText = booking.dropoffLabel ?? booking.dropoffCustomAddress ?? null;
    const dropoffPresetId = booking.dropoffPresetId ?? null;

    // Vehicle returns to ASSIGNED if a fleet driver still owns it; otherwise AVAILABLE.
    // This preserves the fleet-level driver↔vehicle pairing across trips.
    const postTripVehicleStatus = trip.assignment.vehicle.currentDriverId
      ? 'ASSIGNED'
      : 'AVAILABLE';

    await Promise.all([
      // Restore vehicle to correct post-trip status and update its shared location
      // Step 31/33: vehicle location = dropoff (single source of truth for all views)
      this.prisma.vehicle.update({
        where: { id: trip.assignment.vehicleId },
        data: {
          status: postTripVehicleStatus,
          ...(dropoffLocationText
            ? {
                currentLocationText: dropoffLocationText,
                currentLocationPresetId: dropoffPresetId,
                locationUpdatedAt: new Date(),
              }
            : {}),
        },
      }),
      // Mark booking completed
      this.prisma.booking.update({
        where: { id: trip.bookingId },
        data: { status: 'COMPLETED' },
      }),
      // Step 19: Persist driver's new location = trip dropoff point.
      // This is the authoritative location source after a trip ends.
      // It feeds Fleet Master Current Location, Driver Fleet tab, and the
      // Available Vehicles query for future employee bookings.
      // The driver can override this by manually setting their location later.
      dropoffLocationText
        ? this.prisma.driverProfile.update({
            where: { id: trip.assignment.driverId },
            data: {
              currentLocationText: dropoffLocationText,
              currentLocationPresetId: dropoffPresetId,
              locationUpdatedAt: new Date(),
            },
          })
        : Promise.resolve(),
    ]);

    return completedTrip;
  }

  async findAll(userId: string, userRole: string) {
    if (userRole === UserRole.ADMIN) {
      return this.prisma.trip.findMany({
        include: this.tripInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile) return [];

    return this.prisma.trip.findMany({
      where: { assignment: { driverId: driverProfile.id } },
      include: this.tripInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: this.tripInclude,
    });

    if (!trip) throw new NotFoundException('Trip not found');

    if (userRole === UserRole.ADMIN) return trip;

    // Driver can see their own trips
    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (driverProfile && trip.assignment.driverId === driverProfile.id) return trip;

    // Employee can see trips for their bookings
    const booking = await this.prisma.booking.findFirst({
      where: { id: trip.bookingId, requesterId: userId },
    });
    if (booking) return trip;

    throw new ForbiddenException('Access denied');
  }

  async addFuelLog(id: string, dto: AddFuelLogDto, userId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: { assignment: { include: { driver: true } } },
    });

    if (!trip) throw new NotFoundException('Trip not found');

    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile || trip.assignment.driverId !== driverProfile.id) {
      throw new ForbiddenException('Only the assigned driver can add fuel logs');
    }

    return this.prisma.fuelLog.create({
      data: {
        tripId: id,
        vehicleId: trip.assignment.vehicleId,
        fuelVolume: dto.fuelVolume,
        fuelCost: dto.fuelCost ?? null,
        odometerAtRefuel: dto.odometerAtRefuel,
        receiptRef: dto.receiptRef ?? null,
        recordedById: userId,
        recordedAt: new Date(dto.recordedAt),
      },
    });
  }

  async logLocation(tripId: string, dto: LogLocationDto, userId: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      include: { assignment: { include: { driver: true } } },
    });

    if (!trip) throw new NotFoundException('Trip not found');

    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile || trip.assignment.driverId !== driverProfile.id) {
      throw new ForbiddenException('Only the assigned driver can log location');
    }

    // Update trip status to IN_PROGRESS if it was just STARTED
    if (trip.status === 'STARTED') {
      await this.prisma.trip.update({
        where: { id: tripId },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return this.prisma.locationLog.create({
      data: {
        tripId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracy: dto.accuracy ?? null,
        source: dto.source ?? 'LIVE',
        capturedAt: new Date(dto.capturedAt),
      },
    });
  }
}
