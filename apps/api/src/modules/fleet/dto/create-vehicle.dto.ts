import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

enum VehicleType {
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  VAN = 'VAN',
  TRUCK = 'TRUCK',
  BUS = 'BUS',
}

enum VehicleOwnership {
  OWNED = 'OWNED',
  LEASED = 'LEASED',
  HIRED = 'HIRED',
}

export class CreateVehicleDto {
  @ApiProperty({ example: 'MH-12-AB-1234' })
  @IsString()
  @IsNotEmpty()
  vehicleNo!: string;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  type!: VehicleType;

  @ApiPropertyOptional({ example: 'Toyota' })
  @IsOptional()
  @IsString()
  make?: string;

  @ApiPropertyOptional({ example: 'Innova' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional({ example: 2022 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1990)
  year?: number;

  @ApiProperty({ example: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({ enum: VehicleOwnership })
  @IsEnum(VehicleOwnership)
  ownership!: VehicleOwnership;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  maintenanceDueAt?: string;
}
