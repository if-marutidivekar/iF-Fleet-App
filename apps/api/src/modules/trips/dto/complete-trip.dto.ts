import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteTripDto {
  @ApiProperty({ example: 12500.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometerEnd!: number;

  @ApiPropertyOptional({ example: 'Smooth trip, no issues' })
  @IsOptional()
  @IsString()
  remarks?: string;
}
