import { IsNumber, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddFuelLogDto {
  @ApiProperty({ example: 45.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fuelVolume!: number;

  @ApiPropertyOptional({ example: 3640 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fuelCost?: number;

  @ApiProperty({ example: 12250.3 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  odometerAtRefuel!: number;

  @ApiPropertyOptional({ example: 'RECEIPT-2025-0123' })
  @IsOptional()
  @IsString()
  receiptRef?: string;

  @ApiProperty({ example: '2025-08-15T14:30:00.000Z' })
  @IsDateString()
  recordedAt!: string;
}
