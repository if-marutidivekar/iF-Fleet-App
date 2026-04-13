import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@if-fleet/domain';
import { validatePinComplexity } from '../../common/utils/pin.validator';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: { driverProfile: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => this.safeUser(u));
  }

  async findOne(id: string, requesterId: string, requesterRole: string) {
    if (requesterRole !== UserRole.ADMIN && requesterId !== id) {
      throw new ForbiddenException('Access denied');
    }

    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { driverProfile: { select: { id: true } } },
    });

    if (!user) throw new NotFoundException('User not found');
    return this.safeUser(user);
  }

  async create(dto: CreateUserDto, actorId: string) {
    const whereOr: object[] = [{ email: dto.email }];
    if (dto.employeeId) whereOr.push({ employeeId: dto.employeeId });
    if (dto.mobileNumber) whereOr.push({ mobileNumber: dto.mobileNumber });

    const existing = await this.prisma.user.findFirst({
      where: { OR: whereOr, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        'User with this email, employee ID, or mobile number already exists',
      );
    }

    const isDriver = dto.role === UserRole.DRIVER;
    const authMethod = isDriver ? (dto.authMethod ?? 'EMAIL_OTP') : 'EMAIL_OTP';

    let pinHash: string | undefined;
    let pinHmac: string | undefined;

    if (isDriver && authMethod === 'MOBILE_PIN') {
      if (!dto.mobileNumber) {
        throw new BadRequestException('Mobile number is required for MOBILE_PIN drivers');
      }
      if (!dto.initialPin) {
        throw new BadRequestException('Initial PIN is required when creating a MOBILE_PIN driver');
      }
      const err = validatePinComplexity(dto.initialPin);
      if (err) throw new BadRequestException(err);

      pinHmac = this.authService.computePinHmac(dto.initialPin);
      const duplicate = await this.prisma.user.findFirst({
        where: { pinHmac, role: 'DRIVER', status: 'ACTIVE', deletedAt: null },
      });
      if (duplicate) {
        throw new BadRequestException(
          'This PIN is already used by another driver. Choose a different PIN.',
        );
      }
      pinHash = await bcrypt.hash(dto.initialPin, 12);
    }

    const employeeId = dto.employeeId ?? `EMP-${Math.floor(100000 + Math.random() * 900000)}`;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        employeeId,
        phone: dto.phone ?? null,
        role: (dto.role ?? 'EMPLOYEE') as any,
        status: 'ACTIVE',
        authMethod: authMethod as any,
        mobileNumber: dto.mobileNumber ?? null,
        pinHash: pinHash ?? null,
        pinHmac: pinHmac ?? null,
        pinMustChange: isDriver && authMethod === 'MOBILE_PIN',
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'DRIVER_CREATED',
        entityType: 'User',
        entityId: user.id,
        after: {
          name: user.name,
          email: user.email,
          role: user.role,
          authMethod: user.authMethod,
          createdAt: user.createdAt,
        },
      },
    });

    if (isDriver && authMethod === 'MOBILE_PIN') {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DRIVER_PIN_SET',
          entityType: 'User',
          entityId: user.id,
          metadata: { reason: 'Initial PIN set at driver creation' },
        },
      });
    }

    return this.safeUser(user);
  }

  async update(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const authMethodChanging =
      dto.authMethod !== undefined && dto.authMethod !== user.authMethod;

    let pinHash: string | undefined;
    let pinHmac: string | undefined;

    if (dto.authMethod === 'MOBILE_PIN') {
      const mobile = dto.mobileNumber ?? user.mobileNumber;
      if (!mobile) {
        throw new BadRequestException('Mobile number is required for MOBILE_PIN drivers');
      }
      if (!dto.initialPin) {
        throw new BadRequestException('Initial PIN is required when switching to MOBILE_PIN');
      }
      const err = validatePinComplexity(dto.initialPin);
      if (err) throw new BadRequestException(err);

      pinHmac = this.authService.computePinHmac(dto.initialPin);
      const duplicate = await this.prisma.user.findFirst({
        where: { pinHmac, role: 'DRIVER', status: 'ACTIVE', deletedAt: null, NOT: { id } },
      });
      if (duplicate) throw new BadRequestException('This PIN is already used by another driver.');
      pinHash = await bcrypt.hash(dto.initialPin, 12);
    }

    const before = {
      authMethod: user.authMethod,
      status: user.status,
      name: user.name,
      mobileNumber: user.mobileNumber,
    };

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.status !== undefined && { status: dto.status as any }),
        ...(dto.role !== undefined && { role: dto.role as any }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
        ...(dto.mobileNumber !== undefined && { mobileNumber: dto.mobileNumber }),
        ...(dto.authMethod !== undefined && { authMethod: dto.authMethod as any }),
        ...(pinHash !== undefined && { pinHash, pinHmac: pinHmac ?? null, pinMustChange: true }),
      },
      include: { driverProfile: { select: { id: true } } },
    });

    if (authMethodChanging) {
      // Revoke all active sessions immediately
      await this.prisma.deviceSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DRIVER_AUTH_METHOD_CHANGED',
          entityType: 'User',
          entityId: id,
          before: { authMethod: before.authMethod },
          after: { authMethod: updated.authMethod },
          metadata: {
            reason: 'Admin changed driver authentication method; all sessions revoked',
          },
        },
      });

      if (dto.authMethod === 'MOBILE_PIN') {
        await this.prisma.auditLog.create({
          data: {
            actorId,
            action: 'DRIVER_PIN_SET',
            entityType: 'User',
            entityId: id,
            metadata: { reason: 'Initial PIN set when switching auth method to MOBILE_PIN' },
          },
        });
      }
    } else {
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'DRIVER_UPDATED',
          entityType: 'User',
          entityId: id,
          before,
          after: {
            authMethod: updated.authMethod,
            status: updated.status,
            name: updated.name,
          },
        },
      });
    }

    return this.safeUser(updated);
  }

  private safeUser(u: any) {
    return {
      id: u.id,
      employeeId: u.employeeId,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      authMethod: u.authMethod,
      mobileNumber: u.mobileNumber,
      pinMustChange: u.pinMustChange,
      createdAt: u.createdAt,
      hasDriverProfile: !!u.driverProfile,
    };
  }
}
