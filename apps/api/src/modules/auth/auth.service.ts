import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHash, createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { validatePinComplexity } from '../../common/utils/pin.validator';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const COMPANY_DOMAIN = process.env['COMPANY_EMAIL_DOMAIN'] ?? 'company.com';
// HMAC secret for deterministic PIN uniqueness checks — never used for auth
const PIN_HMAC_SECRET = process.env['PIN_HMAC_SECRET'] ?? 'if-fleet-pin-hmac-dev';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
  ) {}

  // ─── Email OTP ──────────────────────────────────────────────────────────────

  async requestOtp(email: string): Promise<{ message: string }> {
    if (!email.toLowerCase().endsWith(`@${COMPANY_DOMAIN}`)) {
      throw new BadRequestException(`Email must be a @${COMPANY_DOMAIN} address`);
    }

    // If the user already exists and is a DRIVER with MOBILE_PIN, reject early
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is inactive or suspended');
      }
      if (existing.authMethod === 'MOBILE_PIN') {
        throw new BadRequestException(
          'This driver account uses Mobile PIN login. Use the PIN login flow instead.',
        );
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashed = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

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

    if (!record) throw new UnauthorizedException('OTP expired or not found');
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

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Auto-provision employee from company email (not allowed for drivers — they must be pre-created)
      const localPart = email.split('@')[0] ?? email;
      const autoName = localPart
        .split('.')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      const autoEmpId = `EMP-${Math.floor(100000 + Math.random() * 900000)}`;

      user = await this.prisma.user.create({
        data: { email, name: autoName, employeeId: autoEmpId, role: 'EMPLOYEE', status: 'ACTIVE' },
      });
    } else {
      if (user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Account is inactive or suspended');
      }
      if (user.authMethod === 'MOBILE_PIN') {
        throw new BadRequestException(
          'This driver account uses Mobile PIN login. Use the PIN login flow instead.',
        );
      }
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

  // ─── Mobile PIN (driver only) ────────────────────────────────────────────────

  /** Step 1: validate that the mobile number belongs to an active MOBILE_PIN driver */
  async requestPinLogin(mobileNumber: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { mobileNumber, deletedAt: null },
    });

    if (!user || user.role !== 'DRIVER' || user.authMethod !== 'MOBILE_PIN') {
      // Generic message — don't reveal whether number exists
      throw new UnauthorizedException('Mobile number not registered for PIN login');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    return { message: 'Mobile number verified. Please enter your PIN.' };
  }

  /** Step 2: verify PIN, return tokens (or pinMustChange flag) */
  async verifyPin(
    mobileNumber: string,
    pin: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    pinMustChange: boolean;
    user: object;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { mobileNumber, deletedAt: null },
    });

    if (!user || user.role !== 'DRIVER' || user.authMethod !== 'MOBILE_PIN') {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is inactive or suspended');
    }
    if (!user.pinHash) {
      throw new UnauthorizedException('PIN not set. Contact your administrator.');
    }

    const valid = await bcrypt.compare(pin, user.pinHash);
    if (!valid) throw new UnauthorizedException('Invalid PIN');

    const accessToken = this.issueAccessToken(user.id, user.email ?? '', user.role);
    const refreshToken = await this.issueRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      pinMustChange: user.pinMustChange,
      user: { id: user.id, name: user.name, mobileNumber: user.mobileNumber, role: user.role },
    };
  }

  /**
   * Forced PIN change — driver must call this immediately after first login
   * or after admin reset, before gaining full access.
   * Requires a valid access token (already issued by verifyPin).
   */
  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
  ): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'DRIVER' || user.authMethod !== 'MOBILE_PIN') {
      throw new ForbiddenException('PIN change is only available for MOBILE_PIN drivers');
    }
    if (!user.pinHash) throw new BadRequestException('No PIN set on this account');

    const currentValid = await bcrypt.compare(currentPin, user.pinHash);
    if (!currentValid) throw new UnauthorizedException('Current PIN is incorrect');

    const complexityError = validatePinComplexity(newPin);
    if (complexityError) throw new BadRequestException(complexityError);

    const newPinHmac = this.computePinHmac(newPin);

    // Uniqueness: reject if any other active MOBILE_PIN driver already uses this PIN
    const duplicate = await this.prisma.user.findFirst({
      where: {
        pinHmac: newPinHmac,
        role: 'DRIVER',
        status: 'ACTIVE',
        deletedAt: null,
        NOT: { id: userId },
      },
    });
    if (duplicate) {
      throw new BadRequestException('This PIN is already in use by another driver. Choose a different PIN.');
    }

    const newPinHash = await bcrypt.hash(newPin, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { pinHash: newPinHash, pinHmac: newPinHmac, pinMustChange: false },
    });

    return { message: 'PIN changed successfully' };
  }

  // ─── Token management ────────────────────────────────────────────────────────

  async refresh(rawRefreshToken: string): Promise<{ accessToken: string }> {
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

    return { accessToken: this.issueAccessToken(user.id, user.email, user.role) };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.deviceSession.updateMany({
      where: { refreshToken: tokenHash },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private issueAccessToken(userId: string, email: string, role: string): string {
    return this.jwt.sign({ sub: userId, email, role });
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const token = uuidv4();
    const tokenHash = this.hashRefreshToken(token);
    await this.prisma.deviceSession.create({
      data: { userId, refreshToken: tokenHash, lastActiveAt: new Date() },
    });
    return token;
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  computePinHmac(pin: string): string {
    return createHmac('sha256', PIN_HMAC_SECRET).update(pin).digest('hex');
  }
}
