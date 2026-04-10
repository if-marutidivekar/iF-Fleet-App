import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UserRole } from '@if-fleet/domain';

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  private bookingInclude = {
    requester: { select: { id: true, name: true, email: true, employeeId: true } },
    approvedBy: { select: { id: true, name: true } },
    pickupPreset: { select: { id: true, name: true, address: true } },
    dropoffPreset: { select: { id: true, name: true, address: true } },
    assignment: {
      include: {
        vehicle: { select: { id: true, vehicleNo: true, type: true, make: true, model: true } },
        driver: {
          include: {
            user: { select: { id: true, name: true, phone: true } },
          },
        },
      },
    },
  } as const;

  async create(dto: CreateBookingDto, requesterId: string) {
    if (!dto.pickupPresetId && !dto.pickupCustomAddress) {
      throw new BadRequestException('Either pickupPresetId or pickupCustomAddress is required');
    }
    if (!dto.dropoffPresetId && !dto.dropoffCustomAddress) {
      throw new BadRequestException('Either dropoffPresetId or dropoffCustomAddress is required');
    }

    // Resolve pickup label
    let pickupLabel: string | undefined;
    if (dto.pickupPresetId) {
      const loc = await this.prisma.presetLocation.findUnique({ where: { id: dto.pickupPresetId } });
      if (!loc) throw new NotFoundException('Pickup preset location not found');
      pickupLabel = loc.name;
    } else {
      pickupLabel = dto.pickupCustomAddress;
    }

    // Resolve dropoff label
    let dropoffLabel: string | undefined;
    if (dto.dropoffPresetId) {
      const loc = await this.prisma.presetLocation.findUnique({ where: { id: dto.dropoffPresetId } });
      if (!loc) throw new NotFoundException('Dropoff preset location not found');
      dropoffLabel = loc.name;
    } else {
      dropoffLabel = dto.dropoffCustomAddress;
    }

    const approvalMode = await this.checkApprovalMode();
    const initialStatus = approvalMode === 'AUTO' ? 'APPROVED' : 'PENDING_APPROVAL';

    return this.prisma.booking.create({
      data: {
        requesterId,
        transportType: dto.transportType,
        passengerCount: dto.passengerCount ?? null,
        materialDescription: dto.materialDescription ?? null,
        pickupPresetId: dto.pickupPresetId ?? null,
        pickupCustomAddress: dto.pickupCustomAddress ?? null,
        pickupLabel: pickupLabel ?? null,
        dropoffPresetId: dto.dropoffPresetId ?? null,
        dropoffCustomAddress: dto.dropoffCustomAddress ?? null,
        dropoffLabel: dropoffLabel ?? null,
        requestedAt: new Date(dto.requestedAt),
        status: initialStatus,
      },
      include: this.bookingInclude,
    });
  }

  async findAll(userId: string, userRole: string) {
    const where =
      userRole === UserRole.ADMIN ? {} : { requesterId: userId };

    return this.prisma.booking.findMany({
      where,
      include: this.bookingInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: this.bookingInclude,
    });

    if (!booking) throw new NotFoundException('Booking not found');

    if (userRole !== UserRole.ADMIN && booking.requesterId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return booking;
  }

  async approve(id: string, adminId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Booking is not in PENDING_APPROVAL state');
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: adminId,
        approvalNote: 'Approved',
      },
      include: this.bookingInclude,
    });
  }

  async reject(id: string, adminId: string, rejectionReason: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Booking is not in PENDING_APPROVAL state');
    }

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedById: adminId,
        rejectionReason,
      },
      include: this.bookingInclude,
    });
  }

  async cancel(id: string, userId: string, userRole: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { assignment: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    if (userRole !== UserRole.ADMIN && booking.requesterId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const cancellableStatuses = ['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED'];
    if (!cancellableStatuses.includes(booking.status)) {
      throw new BadRequestException('Booking cannot be cancelled in its current state');
    }

    // Free the vehicle when cancelling an ASSIGNED booking
    if (booking.status === 'ASSIGNED' && booking.assignment) {
      await this.prisma.vehicle.update({
        where: { id: booking.assignment.vehicleId },
        data: { status: 'AVAILABLE' },
      });
    }

    return this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: this.bookingInclude,
    });
  }

  async checkApprovalMode(): Promise<'MANUAL' | 'AUTO'> {
    const record = await this.prisma.appConfig.findUnique({
      where: { key: 'booking.approvalMode' },
    });
    return (record?.value as 'MANUAL' | 'AUTO') ?? 'MANUAL';
  }
}
