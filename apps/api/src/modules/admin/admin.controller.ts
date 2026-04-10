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
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { SmtpConfig } from '../mail/mail.service';

class SmtpConfigDto implements SmtpConfig {
  @IsString() @IsNotEmpty() host!: string;
  @Type(() => Number) @IsNumber() @Min(1) @Max(65535) port!: number;
  @IsBoolean() secure!: boolean;
  @IsString() @IsNotEmpty() user!: string;
  @IsString() @IsNotEmpty() password!: string;
  @IsEmail() from!: string;
}

class DomainDto {
  @IsString() @IsNotEmpty() domain!: string;
}

class ApprovalModeDto {
  @IsEnum(['MANUAL', 'AUTO']) mode!: 'MANUAL' | 'AUTO';
}

class SessionTimeoutDto {
  @Type(() => Number) @IsNumber() @Min(1) @Max(480) minutes!: number;
}

/** All admin endpoints — JWT required; role enforcement is done in AdminService */
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'admin', version: '1' })
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

  @Put('config/approval-mode')
  @HttpCode(HttpStatus.OK)
  saveApprovalMode(@Body() dto: ApprovalModeDto) {
    return this.adminService.saveApprovalMode(dto.mode);
  }

  @Put('config/session-timeout')
  @HttpCode(HttpStatus.OK)
  saveSessionTimeout(@Body() dto: SessionTimeoutDto) {
    return this.adminService.saveSessionTimeout(dto.minutes);
  }
}
