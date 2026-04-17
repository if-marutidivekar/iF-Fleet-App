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
    // bookingNo is a scalar field — included automatically via findUnique/findMany
    approvedBy: { select: { id: true, name: true } },
    pickupPreset: { select: { id: true, name: true, address: true } },
    dropoffPreset: { select: { id: true, name: true, address: true } },
    assignment: {
      include: {
        vehicle: { select: { id: true, vehicleNo: true, type: true, make: true, model: true } },
        driver: {
          select: {
            id: true,
            currentLocationText: true,
            currentLocationPreset: { select: { id: true, name: true } },
            user: { select: { id: true, name: true, mobileNumber: true } },
          },
        },
        trip: {
          select: {
            id: true, status: true,
            odometerStart: true, odometerEnd: true,
            actualStartAt: true, actualEndAt: true,
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

    // Step 38: Reject past date/time. Allow a 60-second grace window for clock skew.
    const requestedAt = new Date(dto.requestedAt);
    if (requestedAt.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Booking date/time cannot be in the past. Please select a future date and time.');
    }

    const approvalMode = await this.checkApprovalMode();
    const initialStatus = approvalMode === 'AUTO' ? 'APPROVED' : 'PENDING_APPROVAL';

    const booking = await this.prisma.booking.create({
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
        preferredVehicleId: dto.preferredVehicleId ?? null,
      },
    });

    // Always attempt to create a PENDING assignment when employee selected a preferred vehicle.
    // In AUTO mode the booking is already APPROVED so the assignment goes straight to ASSIGNED.
    // In MANUAL mode the booking is PENDING_APPROVAL; we still create the assignment so the
    // driver gets notified immediately — admin approval will keep the assignment in place.
    if (dto.preferredVehicleId) {
      await this.tryAutoAssign(booking.id, dto.preferredVehicleId, requesterId);
    }

    return this.prisma.booking.findUnique({
      where: { id: booking.id },
      include: this.bookingInclude,
    });
  }

  private async tryAutoAssign(bookingId: string, vehicleId: string, requesterId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, deletedAt: null },
      include: {
        currentDriver: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!vehicle?.currentDriverId || !vehicle.currentDriver) return;

    // Guard: don't create duplicate assignments
    const existingAssignment = await this.prisma.assignment.findUnique({
      where: { bookingId },
    });
    if (existingAssignment) return;

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) return;

    // Create assignment — requesterId acts as assignedBy for employee-initiated auto-assigns
    await this.prisma.assignment.create({
      data: {
        bookingId,
        vehicleId: vehicle.id,
        driverId: vehicle.currentDriverId,
        assignedById: requesterId,
        decision: 'PENDING',
        assignedAt: new Date(),
      },
    });

    // In AUTO mode the booking is already APPROVED — immediately elevate to ASSIGNED.
    // In MANUAL mode the booking is PENDING_APPROVAL — keep it there so admin can approve/reject.
    // When admin approves a booking that already has a pending assignment, the approve() method
    // will detect the assignment and transition directly to ASSIGNED.
    if (booking.status === 'APPROVED') {
      await this.prisma.booking.update({
        where: { id: bookingId },
        data: { status: 'ASSIGNED' },
      });
    }

    // Notify the driver in both modes
    await this.prisma.notification.create({
      data: {
        recipientId: vehicle.currentDriver.user.id,
        channel: 'IN_APP',
        title: 'New Trip Assignment',
        body: `A new booking has been assigned to your vehicle ${vehicle.vehicleNo}. Please accept or decline in the Home tab.`,
        deliveryState: 'SENT',
      },
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
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: { assignment: { select: { id: true } } },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_APPROVAL') {
      throw new BadRequestException('Booking is not in PENDING_APPROVAL state');
    }

    // If a preferred-vehicle assignment was already created while the booking was in
    // PENDING_APPROVAL, jump straight to ASSIGNED rather than stopping at APPROVED.
    const finalStatus = booking.assignment ? 'ASSIGNED' : 'APPROVED';

    return this.prisma.booking.update({
      where: { id },
      data: {
        status: finalStatus,
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

    // Step 36: When cancelling an ASSIGNED booking, only revert vehicle to AVAILABLE
    // if it has no fleet-level driver assignment. If a fleet driver owns the vehicle,
    // keep it ASSIGNED — the fleet assignment persists across booking lifecycle events.
    if (booking.status === 'ASSIGNED' && booking.assignment) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: booking.assignment.vehicleId },
        select: { currentDriverId: true },
      });
      if (!vehicle?.currentDriverId) {
        await this.prisma.vehicle.update({
          where: { id: booking.assignment.vehicleId },
          data: { status: 'AVAILABLE' },
        });
      }
      // If vehicle has a fleet driver → leave status ASSIGNED
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
