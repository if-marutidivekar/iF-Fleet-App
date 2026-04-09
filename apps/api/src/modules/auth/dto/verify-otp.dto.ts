import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyOtpDto {
  @ApiProperty({ example: 'jane.doe@company.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'EMP-1042' })
  @IsString()
  employeeId!: string;

  @ApiProperty({ example: '483920', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6)
  otp!: string;
}
