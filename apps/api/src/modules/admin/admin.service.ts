import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MailService, SmtpConfig } from '../mail/mail.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
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
}
