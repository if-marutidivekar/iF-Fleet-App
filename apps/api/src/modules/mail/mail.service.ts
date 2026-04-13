import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Returns SMTP config from DB, or null if not yet configured */
  async getSmtpConfig(): Promise<SmtpConfig | null> {
    const record = await this.prisma.appConfig.findUnique({
      where: { key: 'smtp' },
    });
    if (!record) return null;
    try {
      return JSON.parse(record.value) as SmtpConfig;
    } catch {
      return null;
    }
  }

  /** Save SMTP config to DB */
  async saveSmtpConfig(cfg: SmtpConfig): Promise<void> {
    await this.prisma.appConfig.upsert({
      where: { key: 'smtp' },
      update: { value: JSON.stringify(cfg) },
      create: { key: 'smtp', value: JSON.stringify(cfg) },
    });
  }

  /**
   * Send an OTP email.
   * Falls back to console logging when SMTP is not yet configured
   * (bootstrap mode — admin checks server terminal for OTP).
   */
  async sendOtp(to: string, otp: string): Promise<void> {
    const smtp = await this.getSmtpConfig();

    if (!smtp) {
      // Bootstrap mode: no SMTP configured yet
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.warn(`  SMTP NOT CONFIGURED — OTP for ${to}: ${otp}`);
      this.logger.warn('  Log in as admin and go to Admin → Settings to configure SMTP.');
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.password },
      // Hard timeout so a blocked port fails fast (5 s) instead of hanging
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 5_000,
    });

    try {
      await transporter.sendMail({
        from: smtp.from,
        to,
        subject: 'iF Fleet — Your One-Time Password',
        text: `Your OTP is: ${otp}\n\nThis code expires in 10 minutes.\nDo not share this code with anyone.`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:2rem">
            <h2 style="color:#1d4ed8;margin-bottom:0.5rem">iF Fleet</h2>
            <p style="color:#64748b;margin-top:0">Company fleet management</p>
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:1.5rem 0"/>
            <p style="font-size:15px;color:#0f172a">Your one-time password is:</p>
            <div style="background:#f1f5f9;border-radius:8px;padding:1.5rem;text-align:center;margin:1rem 0">
              <span style="font-size:2.5rem;font-weight:800;letter-spacing:0.5rem;color:#1d4ed8">${otp}</span>
            </div>
            <p style="font-size:13px;color:#64748b">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${to}`);
    } catch (err) {
      // SMTP unreachable (e.g. corporate firewall blocks port 465/587).
      // Log OTP to terminal so dev/testing can proceed without email.
      this.logger.error(`SMTP send failed: ${(err as Error).message}`);
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      this.logger.warn(`  SMTP UNREACHABLE — OTP for ${to}: ${otp}`);
      this.logger.warn('  Fix SMTP settings in Admin → Settings, or use this OTP directly.');
      this.logger.warn('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }

  /** Test SMTP connection — used by admin settings verify button */
  async testSmtp(cfg: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
    try {
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.password },
      });
      await transporter.verify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }
}
