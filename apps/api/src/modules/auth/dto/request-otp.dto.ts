import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: 'jane.doe@company.com' })
  @IsEmail()
  email!: string;
}
