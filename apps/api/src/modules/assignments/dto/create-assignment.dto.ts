import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAssignmentDto {
  @ApiProperty({ example: 'booking-uuid' })
  @IsString()
  @IsNotEmpty()
  bookingId!: string;

  @ApiProperty({ example: 'vehicle-uuid' })
  @IsString()
  @IsNotEmpty()
  vehicleId!: string;

  @ApiProperty({ example: 'driver-profile-uuid' })
  @IsString()
  @IsNotEmpty()
  driverId!: string;
}
