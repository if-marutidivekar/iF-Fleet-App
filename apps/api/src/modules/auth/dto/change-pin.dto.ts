import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePinDto {
  @ApiProperty({ example: '847291', description: 'Current 6-digit PIN' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Current PIN must be exactly 6 digits' })
  currentPin!: string;

  @ApiProperty({ example: '359201', description: 'New 6-digit PIN (complexity rules apply)' })
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'New PIN must be exactly 6 digits' })
  newPin!: string;
}
