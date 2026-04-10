import {
  IsEnum,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsDateString,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum TransportType {
  PERSON = 'PERSON',
  PERSON_WITH_MATERIAL = 'PERSON_WITH_MATERIAL',
  MATERIAL_ONLY = 'MATERIAL_ONLY',
}

export class CreateBookingDto {
  @ApiProperty({ enum: TransportType })
  @IsEnum(TransportType)
  transportType!: TransportType;

  @ApiPropertyOptional({ example: 2, minimum: 1, maximum: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  passengerCount?: number;

  @ApiPropertyOptional({ example: 'Lab equipment - 3 cartons' })
  @IsOptional()
  @IsString()
  materialDescription?: string;

  @ApiPropertyOptional({ example: 'preset-location-uuid' })
  @IsOptional()
  @IsString()
  pickupPresetId?: string;

  @ApiPropertyOptional({ example: '45 Marine Lines, Mumbai' })
  @ValidateIf((o: CreateBookingDto) => !o.pickupPresetId)
  @IsString()
  pickupCustomAddress?: string;

  @ApiPropertyOptional({ example: 'preset-location-uuid' })
  @IsOptional()
  @IsString()
  dropoffPresetId?: string;

  @ApiPropertyOptional({ example: 'Pune Airport' })
  @ValidateIf((o: CreateBookingDto) => !o.dropoffPresetId)
  @IsString()
  dropoffCustomAddress?: string;

  @ApiProperty({ example: '2025-08-15T09:00:00.000Z' })
  @IsDateString()
  requestedAt!: string;
}
