import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { SetLocationDto } from './dto/set-location.dto';
import { UserRole } from '@if-fleet/domain';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vehicles ──────────────────────────────────────────────────────────────

  async listVehicles() {
    return this.prisma.vehicle.findMany({
      where: { deletedAt: null },
      include: {
        currentDriver: {
          include: {
            user: { select: { id: true, name: true, email: true, mobileNumber: true } },
            // Include preset so the "Current Location" column can display the preset name
            currentLocationPreset: { select: { id: true, name: true } },
          },
        },
        // Last booking assignment gives us a location fallback when no driver is set
        assignments: {
          orderBy: { assignedAt: 'desc' },
          take: 1,
          include: {
            booking: { select: { pickupLabel: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Fleet-level Driver↔Vehicle assignment ─────────────────────────────────

  async assignDriver(vehicleId: string, dto: AssignDriverDto, actorId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    // Step 5: block reassignment while vehicle is on an active trip
    if (vehicle.status === 'IN_TRIP') {
      throw new BadRequestException('Cannot assign driver to a vehicle that is currently on an active trip');
    }

    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { id: dto.driverProfileId, deletedAt: null },
      include: { user: { select: { id: true, name: true } }, assignedVehicle: true },
    });
    if (!driverProfile) throw new NotFoundException('Driver profile not found');
    if (!driverProfile.shiftReady) {
      throw new BadRequestException('Driver is not shift-ready. Enable shiftReady first.');
    }
    if (driverProfile.assignedVehicle && driverProfile.assignedVehicle.id !== vehicleId) {
      throw new ConflictException(
        `Driver is already assigned to vehicle ${driverProfile.assignedVehicle.vehicleNo}. Unassign first.`,
      );
    }

    // Step 15: block cross-assignment — admin must explicitly unassign the current driver
    // before assigning a new one.  Silent swaps are not allowed.
    if (vehicle.currentDriverId && vehicle.currentDriverId !== dto.driverProfileId) {
      throw new ConflictException(
        `Vehicle ${vehicle.vehicleNo} is already assigned to a different driver. Unassign them first before assigning a new driver.`,
      );
    }

    const updated = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        currentDriverId: dto.driverProfileId,
        currentDriverAssignedAt: new Date(),
        status: 'ASSIGNED',
      },
      include: {
        currentDriver: {
          include: {
            user: { select: { id: true, name: true, email: true, mobileNumber: true } },
          },
        },
      },
    });

    // Create in-app notification for the assigned driver
    await this.prisma.notification.create({
      data: {
        recipientId: driverProfile.user.id,
        channel: 'IN_APP',
        title: 'Vehicle Assigned',
        body: `You have been assigned to vehicle ${vehicle.vehicleNo}. Please set your current location.`,
        deliveryState: 'SENT',
      },
    });

    return updated;
  }

  async unassignDriver(
    vehicleId: string,
    actorId: string,
    actorRole: UserRole,
  ) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
      include: { currentDriver: { include: { user: true } } },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (!vehicle.currentDriverId) {
      throw new BadRequestException('Vehicle has no driver assigned');
    }
    // Step 5: block release while an active trip is running
    if (vehicle.status === 'IN_TRIP') {
      throw new BadRequestException('Cannot release vehicle while a trip is active');
    }

    // Only ADMIN or the assigned driver themselves can unassign
    if (actorRole === UserRole.DRIVER) {
      const driverProfile = await this.prisma.driverProfile.findFirst({
        where: { userId: actorId },
      });
      if (!driverProfile || driverProfile.id !== vehicle.currentDriverId) {
        throw new ForbiddenException('You can only leave a vehicle assigned to you');
      }
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        currentDriverId: null,
        currentDriverAssignedAt: null,
        status: 'AVAILABLE',
      },
      include: {
        currentDriver: true,
      },
    });
  }

  async setDriverLocation(actorId: string, dto: SetLocationDto) {
    if (!dto.presetId && !dto.customAddress) {
      throw new BadRequestException('Either presetId or customAddress must be provided');
    }

    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId: actorId, deletedAt: null },
    });
    if (!driverProfile) throw new NotFoundException('Driver profile not found for current user');

    let locationText: string | null = dto.customAddress ?? null;
    let presetId: string | null = dto.presetId ?? null;

    if (dto.presetId) {
      const preset = await this.prisma.presetLocation.findUnique({ where: { id: dto.presetId } });
      if (!preset) throw new NotFoundException('Preset location not found');
      locationText = preset.name;
    }

    return this.prisma.driverProfile.update({
      where: { id: driverProfile.id },
      data: {
        currentLocationText: locationText,
        currentLocationPresetId: presetId,
        locationUpdatedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true } },
        currentLocationPreset: { select: { id: true, name: true, address: true } },
      },
    });
  }

  async listAvailableWithDriver(pickupPresetId?: string) {
    // Step 13: Strict filter — when a pickup preset is given, return ONLY vehicles whose
    // driver's current location preset exactly matches the pickup.  No match → empty list
    // so the frontend shows "No Preference" as the safe default (Step 14).
    // Without a pickup preset (custom address or step 3 entered before step 2), return
    // all assigned-driver vehicles that have set their location.
    return this.prisma.vehicle.findMany({
      where: {
        deletedAt: null,
        status: { not: 'IN_TRIP' },
        currentDriverId: { not: null },
        currentDriver: pickupPresetId
          ? { locationUpdatedAt: { not: null }, currentLocationPresetId: pickupPresetId }
          : { locationUpdatedAt: { not: null } },
      },
      include: {
        currentDriver: {
          include: {
            user: { select: { id: true, name: true, mobileNumber: true } },
            currentLocationPreset: { select: { id: true, name: true, address: true } },
          },
        },
      },
      orderBy: { vehicleNo: 'asc' },
    });
  }

  // ── Driver self-service endpoints ─────────────────────────────────────────

  async getMyDriverProfile(userId: string) {
    const profile = await this.prisma.driverProfile.findFirst({
      where: { userId, deletedAt: null },
      include: {
        user: { select: { id: true, name: true, email: true, mobileNumber: true } },
        currentLocationPreset: { select: { id: true, name: true, address: true } },
        assignedVehicle: {
          select: {
            id: true, vehicleNo: true, type: true,
            make: true, model: true, status: true,
            currentDriverAssignedAt: true,
          },
        },
      },
    });
    if (!profile) throw new NotFoundException('Driver profile not found for current user');
    return profile;
  }

  async listAvailableVehicles() {
    return this.prisma.vehicle.findMany({
      where: { deletedAt: null, status: 'AVAILABLE', currentDriverId: null },
      select: { id: true, vehicleNo: true, type: true, make: true, model: true, capacity: true },
      orderBy: { vehicleNo: 'asc' },
    });
  }

  async selfAssignVehicle(vehicleId: string, actorId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status !== 'AVAILABLE') {
      throw new BadRequestException('Vehicle is not available for self-assignment');
    }
    if (vehicle.currentDriverId) {
      throw new ConflictException('Vehicle already has a driver assigned');
    }

    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId: actorId, deletedAt: null },
      include: { assignedVehicle: { select: { id: true, vehicleNo: true } } },
    });
    if (!driverProfile) throw new NotFoundException('Driver profile not found for current user');
    if (!driverProfile.shiftReady) {
      throw new BadRequestException('You must be shift-ready to self-assign a vehicle. Contact admin to enable shift-ready status.');
    }
    if (driverProfile.assignedVehicle) {
      throw new ConflictException(
        `You are already assigned to vehicle ${driverProfile.assignedVehicle.vehicleNo}. Release it first.`,
      );
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        currentDriverId: driverProfile.id,
        currentDriverAssignedAt: new Date(),
        status: 'ASSIGNED',
      },
      include: {
        currentDriver: {
          include: {
            user: { select: { id: true, name: true, email: true, mobileNumber: true } },
            assignedVehicle: { select: { id: true, vehicleNo: true, type: true, make: true, model: true, status: true, currentDriverAssignedAt: true } },
          },
        },
      },
    });
  }

  async createVehicle(dto: CreateVehicleDto) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { vehicleNo: dto.vehicleNo },
    });
    if (existing) throw new ConflictException('Vehicle number already registered');

    return this.prisma.vehicle.create({
      data: {
        vehicleNo: dto.vehicleNo,
        type: dto.type,
        make: dto.make ?? null,
        model: dto.model ?? null,
        year: dto.year ?? null,
        capacity: dto.capacity,
        ownership: dto.ownership,
        maintenanceDueAt: dto.maintenanceDueAt ? new Date(dto.maintenanceDueAt) : null,
      },
    });
  }

  async updateVehicle(id: string, dto: UpdateVehicleDto) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id, deletedAt: null },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        ...(dto.make !== undefined && { make: dto.make }),
        ...(dto.model !== undefined && { model: dto.model }),
        ...(dto.year !== undefined && { year: dto.year }),
        ...(dto.capacity !== undefined && { capacity: dto.capacity }),
        ...(dto.ownership !== undefined && { ownership: dto.ownership }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.maintenanceDueAt !== undefined && {
          maintenanceDueAt: new Date(dto.maintenanceDueAt),
        }),
      },
    });
  }

  // ── Driver Profiles ───────────────────────────────────────────────────────

  async listDrivers() {
    return this.prisma.driverProfile.findMany({
      where: { deletedAt: null },
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true, mobileNumber: true, status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDriver(dto: CreateDriverDto) {
    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.driverProfile.findUnique({
      where: { userId: dto.userId },
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Driver profile already exists for this user');
    }

    const profile = await this.prisma.driverProfile.create({
      data: {
        userId: dto.userId,
        licenseNumber: dto.licenseNumber,
        licenseExpiry: new Date(dto.licenseExpiry),
        shiftReady: dto.shiftReady ?? false,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true, mobileNumber: true, status: true },
        },
      },
    });

    // Upgrade user role to DRIVER
    await this.prisma.user.update({
      where: { id: dto.userId },
      data: { role: 'DRIVER' },
    });

    return profile;
  }

  async updateDriver(id: string, dto: UpdateDriverDto) {
    const profile = await this.prisma.driverProfile.findFirst({
      where: { id, deletedAt: null },
    });
    if (!profile) throw new NotFoundException('Driver profile not found');

    return this.prisma.driverProfile.update({
      where: { id },
      data: {
        ...(dto.licenseNumber !== undefined && { licenseNumber: dto.licenseNumber }),
        ...(dto.licenseExpiry !== undefined && { licenseExpiry: new Date(dto.licenseExpiry) }),
        ...(dto.shiftReady !== undefined && { shiftReady: dto.shiftReady }),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, employeeId: true, mobileNumber: true, status: true },
        },
      },
    });
  }

  // ── Preset Locations ──────────────────────────────────────────────────────

  async listLocations(activeOnly = false) {
    return this.prisma.presetLocation.findMany({
      where: activeOnly ? { isActive: true } : {},
      orderBy: { name: 'asc' },
    });
  }

  async createLocation(dto: CreateLocationDto) {
    return this.prisma.presetLocation.create({
      data: {
        name: dto.name,
        address: dto.address,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        isActive: true,
      },
    });
  }

  async updateLocation(id: string, dto: UpdateLocationDto) {
    const loc = await this.prisma.presetLocation.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException('Preset location not found');

    return this.prisma.presetLocation.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.latitude !== undefined && { latitude: dto.latitude }),
        ...(dto.longitude !== undefined && { longitude: dto.longitude }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}
