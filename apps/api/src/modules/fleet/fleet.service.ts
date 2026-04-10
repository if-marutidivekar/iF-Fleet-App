import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vehicles ──────────────────────────────────────────────────────────────

  async listVehicles() {
    return this.prisma.vehicle.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
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
          select: { id: true, name: true, email: true, employeeId: true, phone: true, status: true },
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
          select: { id: true, name: true, email: true, employeeId: true, phone: true, status: true },
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
          select: { id: true, name: true, email: true, employeeId: true, phone: true, status: true },
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
