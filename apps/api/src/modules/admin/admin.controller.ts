import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { SmtpConfig } from '../mail/mail.service';

class SmtpConfigDto {
  host!: string;
  port!: number;
  secure!: boolean;
  user!: string;
  password!: string;
  from!: string;
}

class DomainDto {
  domain!: string;
}

@UseGuards(AuthGuard('jwt'))
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('config')
  getConfig() {
    return this.adminService.getSystemConfig();
  }

  @Put('config/smtp')
  @HttpCode(HttpStatus.OK)
  saveSmtp(@Body() dto: SmtpConfigDto) {
    return this.adminService.saveSmtpConfig(dto as SmtpConfig);
  }

  @Post('config/smtp/test')
  @HttpCode(HttpStatus.OK)
  testSmtp(@Body() dto: SmtpConfigDto) {
    return this.adminService.testSmtp(dto as SmtpConfig);
  }

  @Put('config/domain')
  @HttpCode(HttpStatus.OK)
  saveDomain(@Body() dto: DomainDto) {
    return this.adminService.saveCompanyDomain(dto.domain);
  }
}
