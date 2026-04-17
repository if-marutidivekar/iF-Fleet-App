import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UserRole } from '@if-fleet/domain';

@Injectable()
export class AssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private assignmentInclude = {
    booking: {
      include: {
        requester: { select: { id: true, name: true, email: true, mobileNumber: true } },
        pickupPreset: { select: { id: true, name: true, address: true } },
        dropoffPreset: { select: { id: true, name: true, address: true } },
      },
    },
    vehicle: { select: { id: true, vehicleNo: true, type: true, make: true, model: true, capacity: true } },
    driver: {
      include: {
        user: { select: { id: true, name: true, email: true, mobileNumber: true } },
      },
    },
    assignedBy: { select: { id: true, name: true } },
    trip: {
      select: { id: true, status: true, odometerStart: true, actualStartAt: true },
    } as const,
  } as const;

  async create(dto: CreateAssignmentDto, adminId: string) {
    // Validate booking is APPROVED
    const booking = await this.prisma.booking.findUnique({ where: { id: dto.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'APPROVED') {
      throw new BadRequestException('Booking must be APPROVED before assigning');
    }

    // Check booking not already assigned
    const existingAssignment = await this.prisma.assignment.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existingAssignment) {
      throw new ConflictException('Booking already has an assignment');
    }

    // Steps 23-26: Validate vehicle availability
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: { vehicleNo: true, status: true, currentDriverId: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    if (vehicle.status === 'IN_TRIP') {
      throw new BadRequestException(
        `Vehicle ${vehicle.vehicleNo} is currently on an active trip and cannot be assigned.`,
      );
    }
    if (['MAINTENANCE', 'INACTIVE'].includes(vehicle.status)) {
      throw new BadRequestException(
        `Vehicle ${vehicle.vehicleNo} is not available (status: ${vehicle.status}).`,
      );
    }
    if (vehicle.status === 'ASSIGNED') {
      if (vehicle.currentDriverId && vehicle.currentDriverId !== dto.driverId) {
        // Fleet Master has a different driver — hard conflict
        const fleetDriver = await this.prisma.driverProfile.findUnique({
          where: { id: vehicle.currentDriverId },
          include: { user: { select: { name: true } } },
        });
        throw new ConflictException(
          `Vehicle ${vehicle.vehicleNo} is fleet-assigned to ${fleetDriver?.user.name ?? 'another driver'}. ` +
          `Use the fleet-assigned driver or unassign them from the vehicle first.`,
        );
      }
      if (!vehicle.currentDriverId) {
        // ASSIGNED via booking without fleet sync — check for active booking assignment
        const activeVehicleAssignment = await this.prisma.assignment.findFirst({
          where: {
            vehicleId: dto.vehicleId,
            decision: { in: ['PENDING', 'ACCEPTED'] },
            booking: { status: { in: ['ASSIGNED', 'IN_TRIP'] } },
          },
          include: { booking: { select: { bookingNo: true } } },
        });
        if (activeVehicleAssignment) {
          throw new BadRequestException(
            `Vehicle ${vehicle.vehicleNo} is already assigned to active booking #${activeVehicleAssignment.booking.bookingNo}.`,
          );
        }
      }
      // vehicle.currentDriverId === dto.driverId: fleet pair matches — allow
    }

    // Steps 23-26: Validate driver availability
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: dto.driverId },
      include: { assignedVehicle: { select: { id: true, vehicleNo: true } } },
    });
    if (!driver || !driver.shiftReady) {
      throw new BadRequestException('Driver is not available or not shift-ready');
    }
    // Fleet Master vehicle cross-check: driver's fleet vehicle must match if set
    if (driver.assignedVehicle && driver.assignedVehicle.id !== dto.vehicleId) {
      throw new ConflictException(
        `This driver is fleet-assigned to vehicle ${driver.assignedVehicle.vehicleNo}. ` +
        `Booking must use their fleet-assigned vehicle, or unassign the driver from it first.`,
      );
    }
    // Step 23: Check driver not already in another active booking assignment
    const activeDriverAssignment = await this.prisma.assignment.findFirst({
      where: {
        driverId: dto.driverId,
        decision: { in: ['PENDING', 'ACCEPTED'] },
        booking: { status: { in: ['ASSIGNED', 'IN_TRIP'] } },
      },
      include: { booking: { select: { bookingNo: true } } },
    });
    if (activeDriverAssignment) {
      throw new ConflictException(
        `Driver is already assigned to booking #${activeDriverAssignment.booking.bookingNo} which is still active. ` +
        `Cannot assign to another booking.`,
      );
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        bookingId: dto.bookingId,
        vehicleId: dto.vehicleId,
        driverId: dto.driverId,
        assignedById: adminId,
        decision: 'PENDING',
      },
      include: this.assignmentInclude,
    });

    // Steps 25-26: Sync Fleet Master — if vehicle was free, establish the driver-vehicle link now.
    // This ensures booking assignment and Fleet Master share one source of truth.
    const vehicleUpdateData: Record<string, unknown> = { status: 'ASSIGNED' };
    if (!vehicle.currentDriverId) {
      vehicleUpdateData['currentDriverId'] = dto.driverId;
      vehicleUpdateData['currentDriverAssignedAt'] = new Date();
    }
    await Promise.all([
      this.prisma.booking.update({
        where: { id: dto.bookingId },
        data: { status: 'ASSIGNED' },
      }),
      this.prisma.vehicle.update({
        where: { id: dto.vehicleId },
        data: vehicleUpdateData,
      }),
    ]);

    return assignment;
  }

  async findAll(userId: string, userRole: string) {
    if (userRole === UserRole.ADMIN) {
      return this.prisma.assignment.findMany({
        include: this.assignmentInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Driver: find their driver profile, then their assignments
    const driverProfile = await this.prisma.driverProfile.findFirst({
      where: { userId },
    });
    if (!driverProfile) return [];

    return this.prisma.assignment.findMany({
      where: { driverId: driverProfile.id },
      include: this.assignmentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: this.assignmentInclude,
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    if (userRole !== UserRole.ADMIN) {
      const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
      if (!driverProfile || assignment.driverId !== driverProfile.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return assignment;
  }

  async accept(id: string, userId: string) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile || assignment.driverId !== driverProfile.id) {
      throw new ForbiddenException('Only the assigned driver can accept');
    }

    if (assignment.decision !== 'PENDING') {
      throw new BadRequestException('Assignment decision already made');
    }

    return this.prisma.assignment.update({
      where: { id },
      data: { decision: 'ACCEPTED', decisionAt: new Date() },
      include: this.assignmentInclude,
    });
  }

  async decline(id: string, userId: string, declineReason: string) {
    const assignment = await this.prisma.assignment.findUnique({ where: { id } });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile || assignment.driverId !== driverProfile.id) {
      throw new ForbiddenException('Only the assigned driver can decline');
    }

    if (assignment.decision !== 'PENDING') {
      throw new BadRequestException('Assignment decision already made');
    }

    // Step 36: Only revert vehicle to AVAILABLE if it has no fleet-level driver.
    // If a fleet driver owns the vehicle, keep it ASSIGNED — the fleet assignment persists
    // independently of booking lifecycle.
    const vehicleForDecline = await this.prisma.vehicle.findUnique({
      where: { id: assignment.vehicleId },
      select: { currentDriverId: true },
    });
    if (!vehicleForDecline?.currentDriverId) {
      await this.prisma.vehicle.update({
        where: { id: assignment.vehicleId },
        data: { status: 'AVAILABLE' },
      });
    }
    // If vehicle still has a fleet driver → leave status as ASSIGNED

    return this.prisma.assignment.update({
      where: { id },
      data: { decision: 'DECLINED', decisionAt: new Date(), declineReason },
      include: this.assignmentInclude,
    });
  }

  async driverCancel(id: string, userId: string, cancelReason?: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile || assignment.driverId !== driverProfile.id) {
      throw new ForbiddenException('Only the assigned driver can cancel');
    }

    if (assignment.decision !== 'ACCEPTED') {
      throw new BadRequestException('Can only cancel an accepted assignment');
    }

    if (!['ASSIGNED'].includes(assignment.booking.status)) {
      throw new BadRequestException('Booking is not in a cancellable state');
    }

    // Step 36: Only revert vehicle to AVAILABLE if it has no fleet-level driver.
    // Fleet assignment must persist independently of booking cancellation.
    const vehicleForCancel = await this.prisma.vehicle.findUnique({
      where: { id: assignment.vehicleId },
      select: { currentDriverId: true },
    });
    if (!vehicleForCancel?.currentDriverId) {
      await this.prisma.vehicle.update({
        where: { id: assignment.vehicleId },
        data: { status: 'AVAILABLE' },
      });
    }
    // If vehicle still has a fleet driver → leave status as ASSIGNED

    return this.prisma.assignment.update({
      where: { id },
      data: {
        decision: 'DECLINED',
        decisionAt: new Date(),
        declineReason: cancelReason ?? 'Driver cancelled',
      },
      include: this.assignmentInclude,
    });
  }

  async findAvailableForDrivers() {
    return this.prisma.booking.findMany({
      where: {
        status: 'APPROVED',
        assignment: null,
      },
      include: {
        requester: { select: { id: true, name: true, email: true, mobileNumber: true } },
        pickupPreset: { select: { id: true, name: true, address: true } },
        dropoffPreset: { select: { id: true, name: true, address: true } },
      },
      orderBy: { requestedAt: 'asc' },
    });
  }

  async selfAssign(bookingId: string, vehicleId: string, userId: string) {
    const driverProfile = await this.prisma.driverProfile.findFirst({ where: { userId } });
    if (!driverProfile) throw new ForbiddenException('No driver profile found');
    if (!driverProfile.shiftReady) throw new BadRequestException('Driver is not shift-ready');

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { assignment: true },
    });
    if (!booking || booking.status !== 'APPROVED') {
      throw new BadRequestException('Booking is not available for self-assignment');
    }
    if (booking.assignment) throw new ConflictException('Booking already has an assignment');

    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || vehicle.status !== 'AVAILABLE') {
      throw new BadRequestException('Vehicle is not available');
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        bookingId,
        vehicleId,
        driverId: driverProfile.id,
        assignedById: userId,
        decision: 'ACCEPTED',
        decisionAt: new Date(),
      },
      include: this.assignmentInclude,
    });

    await Promise.all([
      this.prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'ASSIGNED' } }),
      this.prisma.booking.update({ where: { id: bookingId }, data: { status: 'ASSIGNED' } }),
    ]);

    return assignment;
  }

  async reassign(id: string, vehicleId: string, driverId: string, adminId: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: { booking: true },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    // Only reassign from ASSIGNED booking
    if (assignment.booking.status !== 'ASSIGNED') {
      throw new BadRequestException('Can only reassign ASSIGNED bookings');
    }

    // Step 37: Validate new vehicle — AVAILABLE or ASSIGNED-non-conflicting are both acceptable.
    const newVehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { vehicleNo: true, status: true, currentDriverId: true },
    });
    if (!newVehicle) throw new NotFoundException('New vehicle not found');
    if (newVehicle.status === 'IN_TRIP') {
      throw new BadRequestException(`Vehicle ${newVehicle.vehicleNo} is currently on an active trip.`);
    }
    if (['MAINTENANCE', 'INACTIVE'].includes(newVehicle.status)) {
      throw new BadRequestException(`Vehicle ${newVehicle.vehicleNo} is not available (status: ${newVehicle.status}).`);
    }
    if (newVehicle.status === 'ASSIGNED') {
      // Fleet driver cross-check
      if (newVehicle.currentDriverId && newVehicle.currentDriverId !== driverId) {
        throw new ConflictException(
          `Vehicle ${newVehicle.vehicleNo} is fleet-assigned to a different driver. ` +
          `Use the fleet-assigned driver or unassign them first.`,
        );
      }
      // Check for active conflicting booking (exclude the current assignment being reassigned)
      if (!newVehicle.currentDriverId) {
        const conflicting = await this.prisma.assignment.findFirst({
          where: {
            vehicleId,
            id: { not: id },
            decision: { in: ['PENDING', 'ACCEPTED'] },
            booking: { status: { in: ['ASSIGNED', 'IN_TRIP'] } },
          },
          include: { booking: { select: { bookingNo: true } } },
        });
        if (conflicting) {
          throw new BadRequestException(
            `Vehicle ${newVehicle.vehicleNo} is already assigned to active booking #${conflicting.booking.bookingNo}.`,
          );
        }
      }
    }

    // Free the old vehicle if it differs — only revert to AVAILABLE if no fleet driver
    if (vehicleId !== assignment.vehicleId) {
      const oldVehicle = await this.prisma.vehicle.findUnique({
        where: { id: assignment.vehicleId },
        select: { currentDriverId: true },
      });
      if (!oldVehicle?.currentDriverId) {
        await this.prisma.vehicle.update({
          where: { id: assignment.vehicleId },
          data: { status: 'AVAILABLE' },
        });
      }
    }
    // Always mark the chosen vehicle as ASSIGNED
    await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'ASSIGNED' },
    });

    // Validate new driver
    if (driverId !== assignment.driverId) {
      const newDriver = await this.prisma.driverProfile.findUnique({
        where: { id: driverId },
        include: { assignedVehicle: { select: { id: true, vehicleNo: true } } },
      });
      if (!newDriver || !newDriver.shiftReady) {
        throw new BadRequestException('New driver is not available or not shift-ready');
      }
      // Step 17: If the new driver has a fleet vehicle, it must match the booking vehicle
      if (newDriver.assignedVehicle && newDriver.assignedVehicle.id !== vehicleId) {
        throw new ConflictException(
          `This driver is fleet-assigned to vehicle ${newDriver.assignedVehicle.vehicleNo}. ` +
          `Reassignment must use their fleet-assigned vehicle or unassign them from it first.`,
        );
      }
    }

    return this.prisma.assignment.update({
      where: { id },
      data: {
        vehicleId,
        driverId,
        assignedById: adminId,
        decision: 'PENDING',
        decisionAt: null,
        declineReason: null,
      },
      include: this.assignmentInclude,
    });
  }
}
