import { IsString, IsOptional, IsEnum, Matches, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus, DriverAuthMethod } from '@if-fleet/domain';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '+91-9876543210' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ example: 'EMP-1042' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  // ─── Driver-specific fields ───────────────────────────────────────────────

  @ApiPropertyOptional({
    enum: DriverAuthMethod,
    description: 'Changing this revokes all active sessions immediately and requires fresh login.',
  })
  @IsOptional()
  @IsEnum(DriverAuthMethod)
  authMethod?: DriverAuthMethod;

  @ApiPropertyOptional({ example: '+919876543210' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid mobile number format' })
  mobileNumber?: string;

  @ApiPropertyOptional({
    example: '847291',
    description: 'Required when switching to MOBILE_PIN. Driver must change at next login.',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  initialPin?: string;
}
