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
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { UserRole } from '@if-fleet/domain';
import { validatePinComplexity } from '../../common/utils/pin.validator';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  /** Compute display name from first + last name, falling back to whatever is stored */
  private computeName(firstName?: string | null, lastName?: string | null, fallback = ''): string {
    const parts = [firstName, lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : fallback;
  }

  /** Strip sensitive fields from a user record */
  private safeUser(u: any) {
    const profileCompleted = !!(
      u.firstName && u.lastName && u.employeeId && u.department && u.mobileNumber
    );
    return {
      id: u.id,
      userCode: u.userCode,
      employeeId: u.employeeId,
      firstName: u.firstName ?? null,
      lastName: u.lastName ?? null,
      name: u.name,
      email: u.email,
      department: u.department ?? null,
      role: u.role,
      status: u.status,
      authMethod: u.authMethod,
      mobileNumber: u.mobileNumber,
      pinMustChange: u.pinMustChange,
      profileCompleted,
      createdAt: u.createdAt,
      hasDriverProfile: !!u.driverProfile,
    };
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

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

  // ─── Admin: Create User ───────────────────────────────────────────────────────

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
    const displayName = this.computeName(dto.firstName, dto.lastName) || (dto.email.split('@')[0] ?? dto.email);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName ?? null,
        lastName: dto.lastName ?? null,
        name: displayName,
        email: dto.email,
        employeeId,
        department: dto.department ?? null,
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

  // ─── Admin: Update User ───────────────────────────────────────────────────────

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

    // Compute updated name if firstName/lastName changed
    const newFirstName = dto.firstName !== undefined ? dto.firstName : user.firstName;
    const newLastName  = dto.lastName  !== undefined ? dto.lastName  : user.lastName;
    const newName = this.computeName(newFirstName, newLastName, user.name);

    const before = {
      authMethod: user.authMethod,
      status: user.status,
      name: user.name,
      mobileNumber: user.mobileNumber,
    };

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName  !== undefined && { firstName:  dto.firstName }),
        ...(dto.lastName   !== undefined && { lastName:   dto.lastName }),
        ...(dto.department !== undefined && { department: dto.department }),
        name: newName,
        ...(dto.status     !== undefined && { status:     dto.status as any }),
        ...(dto.role       !== undefined && { role:       dto.role as any }),
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

  // ─── Self-service: Update Own Profile ────────────────────────────────────────

  async updateMyProfile(userId: string, dto: UpdateMyProfileDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    // If mobileNumber is changing, check for conflicts
    if (dto.mobileNumber && dto.mobileNumber !== user.mobileNumber) {
      const conflict = await this.prisma.user.findFirst({
        where: { mobileNumber: dto.mobileNumber, deletedAt: null, NOT: { id: userId } },
      });
      if (conflict) {
        throw new ConflictException('This mobile number is already registered to another account');
      }
    }

    // If employeeId is changing, check for conflicts
    if (dto.employeeId && dto.employeeId !== user.employeeId) {
      const conflict = await this.prisma.user.findFirst({
        where: { employeeId: dto.employeeId, deletedAt: null, NOT: { id: userId } },
      });
      if (conflict) {
        throw new ConflictException('This Employee ID is already in use');
      }
    }

    const newName = this.computeName(dto.firstName, dto.lastName, user.name);

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        name: newName,
        ...(dto.employeeId  !== undefined && { employeeId:  dto.employeeId }),
        ...(dto.department  !== undefined && { department:  dto.department }),
        ...(dto.mobileNumber !== undefined && { mobileNumber: dto.mobileNumber }),
      },
      include: { driverProfile: { select: { id: true } } },
    });

    return this.safeUser(updated);
  }

  // ─── Admin: Bulk CSV Import ───────────────────────────────────────────────────

  async bulkImportCsv(csvText: string, actorId: string): Promise<{
    total: number;
    created: number;
    updated: number;
    failed: number;
    errors: Array<{ row: number; email: string; error: string }>;
  }> {
    const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      throw new BadRequestException('CSV must have a header row and at least one data row');
    }

    // Parse header
    const headers = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
    const requiredHeaders = ['email'];
    for (const req of requiredHeaders) {
      if (!headers.includes(req)) {
        throw new BadRequestException(`CSV is missing required column: ${req}`);
      }
    }

    const col = (row: string[], name: string): string => {
      const idx = headers.indexOf(name);
      return idx >= 0 ? (row[idx] ?? '').trim() : '';
    };

    const results = { total: 0, created: 0, updated: 0, failed: 0, errors: [] as Array<{ row: number; email: string; error: string }> };

    for (let i = 1; i < lines.length; i++) {
      const rowNum = i + 1; // 1-based for user display
      const cells = this.parseCsvRow(lines[i]!);
      const email = col(cells, 'email');

      if (!email) continue; // skip blank rows

      results.total++;

      try {
        const firstName  = col(cells, 'firstname')  || col(cells, 'first_name')  || undefined;
        const lastName   = col(cells, 'lastname')   || col(cells, 'last_name')   || undefined;
        const employeeId = col(cells, 'employeeid') || col(cells, 'employee_id') || undefined;
        const department = col(cells, 'department') || undefined;
        const roleRaw    = col(cells, 'role').toUpperCase();
        const role       = ['EMPLOYEE', 'DRIVER', 'ADMIN'].includes(roleRaw) ? roleRaw : 'EMPLOYEE';
        const authMethod = col(cells, 'authmethod') || col(cells, 'auth_method') || 'EMAIL_OTP';
        const mobileNumber = col(cells, 'mobilenumber') || col(cells, 'mobile_number') || undefined;
        const initialPin = col(cells, 'initialpin') || col(cells, 'initial_pin') || undefined;

        const displayName = [firstName, lastName].filter(Boolean).join(' ') || (email.split('@')[0] ?? email);

        const existing = await this.prisma.user.findFirst({ where: { email, deletedAt: null } });

        if (existing) {
          // Update existing user
          await this.prisma.user.update({
            where: { id: existing.id },
            data: {
              ...(firstName  && { firstName }),
              ...(lastName   && { lastName }),
              name: [firstName ?? existing.firstName, lastName ?? existing.lastName].filter(Boolean).join(' ') || existing.name,
              ...(department && { department }),
              ...(employeeId && { employeeId }),
              ...(mobileNumber && { mobileNumber }),
            },
          });
          results.updated++;
        } else {
          // Create new user
          let pinHash: string | undefined;
          let pinHmac: string | undefined;

          if (role === 'DRIVER' && authMethod === 'MOBILE_PIN' && initialPin) {
            const complexityErr = validatePinComplexity(initialPin);
            if (complexityErr) throw new Error(complexityErr);
            pinHmac = this.authService.computePinHmac(initialPin);
            pinHash = await bcrypt.hash(initialPin, 12);
          }

          const empId = employeeId || `EMP-${Math.floor(100000 + Math.random() * 900000)}`;

          await this.prisma.user.create({
            data: {
              email,
              firstName: firstName ?? null,
              lastName: lastName ?? null,
              name: displayName,
              employeeId: empId,
              department: department ?? null,
              role: role as any,
              status: 'ACTIVE',
              authMethod: (authMethod === 'MOBILE_PIN' ? 'MOBILE_PIN' : 'EMAIL_OTP') as any,
              mobileNumber: mobileNumber ?? null,
              pinHash: pinHash ?? null,
              pinHmac: pinHmac ?? null,
              pinMustChange: role === 'DRIVER' && authMethod === 'MOBILE_PIN' && !!initialPin,
            },
          });
          results.created++;
        }
      } catch (err: any) {
        results.failed++;
        const errMsg: string = err?.message ?? 'Unknown error';
        // Handle unique constraint violations gracefully
        const displayErr = errMsg.includes('Unique constraint') ? 'Duplicate email, employeeId, or mobile number' : errMsg;
        (results.errors as any[]).push({ row: rowNum, email, error: displayErr });
      }
    }

    return results;
  }

  /** Simple CSV row parser that handles quoted fields */
  private parseCsvRow(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  // ─── Push Token Registration ──────────────────────────────────────────────────

  /**
   * Store or update the FCM/APNs push token for the calling user's most recent
   * active DeviceSession. Called by the mobile app on startup after login.
   * Fire-and-forget — failure is non-critical for the user.
   */
  async registerPushToken(
    userId: string,
    pushToken: string,
    deviceType: string,
  ): Promise<{ ok: boolean }> {
    // Update the most recent non-revoked session for this user
    const session = await this.prisma.deviceSession.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
      select: { id: true },
    });

    if (session) {
      await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: { pushToken, deviceType, lastActiveAt: new Date() },
      });
    }

    return { ok: true };
  }
}
