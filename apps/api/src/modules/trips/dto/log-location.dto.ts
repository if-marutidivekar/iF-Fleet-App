import { IsNumber, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum LocationSource {
  LIVE = 'LIVE',
  DELAYED_SYNC = 'DELAYED_SYNC',
  SIMULATED = 'SIMULATED',
}

export class LogLocationDto {
  @ApiProperty({ example: 19.0760 })
  @Type(() => Number)
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: 72.8777 })
  @Type(() => Number)
  @IsNumber()
  longitude!: number;

  @ApiPropertyOptional({ example: 5.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  accuracy?: number;

  @ApiPropertyOptional({ enum: LocationSource, default: LocationSource.LIVE })
  @IsOptional()
  @IsEnum(LocationSource)
  source?: LocationSource;

  @ApiProperty({ example: '2025-08-15T14:30:00.000Z' })
  @IsDateString()
  capturedAt!: string;
}
