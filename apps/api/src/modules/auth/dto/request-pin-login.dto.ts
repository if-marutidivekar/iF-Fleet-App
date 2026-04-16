import { IsString, IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPinLoginDto {
  @ApiProperty({ example: '+919876543210', description: 'Registered mobile number' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[1-9]\d{7,14}$/, { message: 'Invalid mobile number format' })
  mobileNumber!: string;
}
