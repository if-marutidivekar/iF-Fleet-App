import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService } from '../mail/mail.service';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const COMPANY_DOMAIN = process.env['COMPANY_EMAIL_DOMAIN'] ?? 'company.com';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  async requestOtp(email: string): Promise<{ message: string }> {
    if (!email.toLowerCase().endsWith(`@${COMPANY_DOMAIN}`)) {
      throw new BadRequestException(`Email must be a @${COMPANY_DOMAIN} address`);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Invalidate previous unused OTPs for this email
    await this.prisma.otpRecord.updateMany({
      where: { email, used: false },
      data: { used: true },
    });

    await this.prisma.otpRecord.create({
      data: { email, otp: hashed, expiresAt },
    });

    await this.mailService.sendOtp(email, otp);

    return { message: 'OTP sent to your email address' };
  }

  async verifyOtp(
    email: string,
    otp: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const record = await this.prisma.otpRecord.findFirst({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      throw new UnauthorizedException('OTP expired or not found');
    }

    if (record.attempts >= OTP_MAX_ATTEMPTS) {
      throw new ForbiddenException('Too many failed attempts; request a new OTP');
    }

    const valid = await bcrypt.compare(otp, record.otp);
    if (!valid) {
      await this.prisma.otpRecord.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Invalid OTP');
    }

    // Look up user by email only
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Auto-create user from company email
      const localPart = email.split('@')[0] ?? email;
      const autoName = localPart
        .split('.')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      const autoEmpId = `EMP-${Math.floor(100000 + Math.random() * 900000)}`;

      user = await this.prisma.user.create({
        data: {
          email,
          name: autoName,
          employeeId: autoEmpId,
          role: 'EMPLOYEE',
          status: 'ACTIVE',
        },
      });
    } else if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    await this.prisma.otpRecord.update({ where: { id: record.id }, data: { used: true } });

    const accessToken = this.issueAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string }> {
    // SHA-256 is deterministic — safe for lookup unlike bcrypt
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const session = await this.prisma.deviceSession.findFirst({
      where: { refreshToken: tokenHash, revokedAt: null },
    });

    if (!session) throw new UnauthorizedException('Invalid or revoked refresh token');

    const user = await this.prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
    }

    const accessToken = this.issueAccessToken(user.id, user.email, user.role);
    return { accessToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.deviceSession.updateMany({
      where: { refreshToken: tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  private issueAccessToken(userId: string, email: string, role: string): string {
    return this.jwt.sign({ sub: userId, email, role });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const tokenHash = this.hashRefreshToken(token);

    await this.prisma.deviceSession.create({
      data: { userId, refreshToken: tokenHash, lastActiveAt: new Date() },
    });

    return token; // raw token returned to client; only hash stored in DB
  }

  /** SHA-256 is deterministic, so the same token always produces the same hash —
   *  making DB lookup possible without storing the raw token. */
  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
