import {
  IsEmail, IsString, IsNotEmpty, IsOptional, IsEnum, Matches, Length,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, DriverAuthMethod } from '@if-fleet/domain';

export class CreateUserDto {
  @ApiProperty({ example: 'jane.doe@ideaforgetech.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ example: 'EMP-1042' })
  @IsOptional()
  @IsString()
  employeeId?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.EMPLOYEE })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  // ─── Driver-specific fields ───────────────────────────────────────────────

  @ApiPropertyOptional({
    enum: DriverAuthMethod,
    default: DriverAuthMethod.EMAIL_OTP,
    description: 'Admin-controlled driver authentication method. Ignored for non-driver roles.',
  })
  @IsOptional()
  @IsEnum(DriverAuthMethod)
  authMethod?: DriverAuthMethod;

  @ApiPropertyOptional({
    example: '+919876543210',
    description: 'Required when authMethod = MOBILE_PIN',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid mobile number format' })
  mobileNumber?: string;

  @ApiPropertyOptional({
    example: '847291',
    description: 'Initial 6-digit PIN — required when authMethod = MOBILE_PIN. Driver must change at first login.',
  })
  @IsOptional()
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'PIN must be exactly 6 digits' })
  initialPin?: string;
}
