import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
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
  Length,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { SmtpConfig } from '../mail/mail.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@if-fleet/domain';

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

class ResetPinDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  newPin!: string;
}

interface JwtUser { sub: string; role: UserRole; }

/** All admin endpoints — JWT + ADMIN role required */
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
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

  // ─── Driver PIN management ─────────────────────────────────────────────────

  @Post('drivers/:id/reset-pin')
  @HttpCode(HttpStatus.OK)
  resetDriverPin(
    @Param('id') driverId: string,
    @Body() dto: ResetPinDto,
    @CurrentUser() actor: JwtUser,
  ) {
    return this.adminService.resetDriverPin(driverId, dto.newPin, actor.sub);
  }
}
