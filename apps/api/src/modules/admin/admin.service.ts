import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService, SmtpConfig } from '../mail/mail.service';
import { validatePinComplexity } from '../../common/utils/pin.validator';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly authService: AuthService,
  ) {}

  async getSystemConfig(): Promise<{
    smtp: SmtpConfig | null;
    companyDomain: string;
    smtpConfigured: boolean;
    approvalMode: 'MANUAL' | 'AUTO';
    sessionTimeoutMinutes: number;
  }> {
    const smtp = await this.mail.getSmtpConfig();
    const [domainRecord, approvalModeRecord, sessionTimeoutRecord] = await Promise.all([
      this.prisma.appConfig.findUnique({ where: { key: 'auth.companyDomain' } }),
      this.prisma.appConfig.findUnique({ where: { key: 'booking.approvalMode' } }),
      this.prisma.appConfig.findUnique({ where: { key: 'auth.sessionTimeout' } }),
    ]);

    const companyDomain =
      domainRecord?.value ?? process.env['COMPANY_EMAIL_DOMAIN'] ?? 'ideaforgetech.com';

    // Redact password in response
    const safeSmtp = smtp
      ? { ...smtp, password: smtp.password ? '••••••••' : '' }
      : null;

    return {
      smtp: safeSmtp,
      companyDomain,
      smtpConfigured: !!smtp,
      approvalMode: (approvalModeRecord?.value as 'MANUAL' | 'AUTO') ?? 'MANUAL',
      sessionTimeoutMinutes: parseInt(sessionTimeoutRecord?.value ?? '30', 10),
    };
  }

  async saveSmtpConfig(cfg: SmtpConfig): Promise<void> {
    await this.mail.saveSmtpConfig(cfg);
  }

  async testSmtp(cfg: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
    return this.mail.testSmtp(cfg);
  }

  async saveCompanyDomain(domain: string): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { key: 'auth.companyDomain' },
      update: { value: domain },
      create: { key: 'auth.companyDomain', value: domain },
    });
  }

  async saveApprovalMode(mode: 'MANUAL' | 'AUTO'): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { key: 'booking.approvalMode' },
      update: { value: mode },
      create: { key: 'booking.approvalMode', value: mode },
    });
  }

  async saveSessionTimeout(minutes: number): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { key: 'auth.sessionTimeout' },
      update: { value: String(minutes) },
      create: { key: 'auth.sessionTimeout', value: String(minutes) },
    });
  }

  // ─── Driver PIN management ───────────────────────────────────────────────────

  /**
   * Admin resets a MOBILE_PIN driver's PIN.
   * - Validates the new PIN against complexity rules and uniqueness.
   * - Sets pinMustChange = true so the driver is forced to change at next login.
   * - Revokes all active sessions.
   * - Creates an audit record.
   */
  async resetDriverPin(
    driverId: string,
    newPin: string,
    actorId: string,
  ): Promise<{ message: string }> {
    const driver = await this.prisma.user.findFirst({
      where: { id: driverId, role: 'DRIVER', deletedAt: null },
    });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.authMethod !== 'MOBILE_PIN') {
      throw new BadRequestException('PIN reset is only applicable to MOBILE_PIN drivers');
    }

    const complexityError = validatePinComplexity(newPin);
    if (complexityError) throw new BadRequestException(complexityError);

    const newPinHmac = this.authService.computePinHmac(newPin);
    const duplicate = await this.prisma.user.findFirst({
      where: {
        pinHmac: newPinHmac,
        role: 'DRIVER',
        status: 'ACTIVE',
        deletedAt: null,
        NOT: { id: driverId },
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        'This PIN is already in use by another driver. Choose a different PIN.',
      );
    }

    const newPinHash = await bcrypt.hash(newPin, 12);

    await this.prisma.user.update({
      where: { id: driverId },
      data: { pinHash: newPinHash, pinHmac: newPinHmac, pinMustChange: true },
    });

    // Revoke all active sessions — driver must re-login with new PIN
    await this.prisma.deviceSession.updateMany({
      where: { userId: driverId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'DRIVER_PIN_RESET',
        entityType: 'User',
        entityId: driverId,
        metadata: {
          reason: 'Admin reset driver PIN; all sessions revoked; pinMustChange set',
        },
      },
    });

    return { message: 'Driver PIN reset successfully. Driver must change PIN at next login.' };
  }
}
