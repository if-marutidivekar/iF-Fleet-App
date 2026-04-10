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
  }> {
    const smtp = await this.mail.getSmtpConfig();
    const domainRecord = await this.prisma.appConfig.findUnique({
      where: { key: 'auth.companyDomain' },
    });
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
}
