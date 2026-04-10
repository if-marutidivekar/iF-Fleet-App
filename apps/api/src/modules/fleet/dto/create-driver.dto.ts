import { IsString, IsNotEmpty, IsBoolean, IsOptional, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDriverDto {
  @ApiProperty({ example: 'user-uuid-here' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ example: 'MH1220240012345' })
  @IsString()
  @IsNotEmpty()
  licenseNumber!: string;

  @ApiProperty({ example: '2027-06-30' })
  @IsDateString()
  licenseExpiry!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  shiftReady?: boolean;
}
