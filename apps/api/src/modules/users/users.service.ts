import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from '@if-fleet/domain';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      include: { driverProfile: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => ({
      id: u.id,
      employeeId: u.employeeId,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      hasDriverProfile: !!u.driverProfile,
    }));
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

    return {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      hasDriverProfile: !!user.driverProfile,
    };
  }

  async create(dto: CreateUserDto) {
    const whereOr: { email?: string; employeeId?: string }[] = [{ email: dto.email }];
    if (dto.employeeId) whereOr.push({ employeeId: dto.employeeId });
    const existing = await this.prisma.user.findFirst({
      where: { OR: whereOr, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('User with this email or employee ID already exists');
    }

    const employeeId = dto.employeeId || `EMP-${Math.floor(100000 + Math.random() * 900000)}`;

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        employeeId,
        phone: dto.phone ?? null,
        role: dto.role ?? 'EMPLOYEE',
        status: 'ACTIVE',
      },
    });

    return {
      id: user.id,
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      hasDriverProfile: false,
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.employeeId !== undefined && { employeeId: dto.employeeId }),
      },
      include: { driverProfile: { select: { id: true } } },
    });

    return {
      id: updated.id,
      employeeId: updated.employeeId,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      role: updated.role,
      status: updated.status,
      createdAt: updated.createdAt,
      hasDriverProfile: !!updated.driverProfile,
    };
  }
}
