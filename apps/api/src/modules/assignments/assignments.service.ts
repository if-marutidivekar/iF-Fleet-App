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
        requester: { select: { id: true, name: true, email: true } },
        pickupPreset: { select: { id: true, name: true, address: true } },
        dropoffPreset: { select: { id: true, name: true, address: true } },
      },
    },
    vehicle: { select: { id: true, vehicleNo: true, type: true, make: true, model: true, capacity: true } },
    driver: {
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
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

    // Validate vehicle is AVAILABLE
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: dto.vehicleId } });
    if (!vehicle || vehicle.status !== 'AVAILABLE') {
      throw new BadRequestException('Vehicle is not available');
    }

    // Validate driver exists and is shiftReady
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: dto.driverId } });
    if (!driver || !driver.shiftReady) {
      throw new BadRequestException('Driver is not available or not shift-ready');
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

    // Update booking status and vehicle status
    await Promise.all([
      this.prisma.booking.update({
        where: { id: dto.bookingId },
        data: { status: 'ASSIGNED' },
      }),
      this.prisma.vehicle.update({
        where: { id: dto.vehicleId },
        data: { status: 'ASSIGNED' },
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

    // Revert booking to APPROVED and vehicle to AVAILABLE
    await Promise.all([
      this.prisma.booking.update({
        where: { id: assignment.bookingId },
        data: { status: 'APPROVED' },
      }),
      this.prisma.vehicle.update({
        where: { id: assignment.vehicleId },
        data: { status: 'AVAILABLE' },
      }),
    ]);

    return this.prisma.assignment.update({
      where: { id },
      data: { decision: 'DECLINED', decisionAt: new Date(), declineReason },
      include: this.assignmentInclude,
    });
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

    // Validate new vehicle is AVAILABLE (or same vehicle)
    if (vehicleId !== assignment.vehicleId) {
      const newVehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
      if (!newVehicle || newVehicle.status !== 'AVAILABLE') {
        throw new BadRequestException('New vehicle is not available');
      }
      // Free old vehicle
      await this.prisma.vehicle.update({
        where: { id: assignment.vehicleId },
        data: { status: 'AVAILABLE' },
      });
      // Assign new vehicle
      await this.prisma.vehicle.update({
        where: { id: vehicleId },
        data: { status: 'ASSIGNED' },
      });
    }

    // Validate new driver
    if (driverId !== assignment.driverId) {
      const newDriver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
      if (!newDriver || !newDriver.shiftReady) {
        throw new BadRequestException('New driver is not available or not shift-ready');
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
