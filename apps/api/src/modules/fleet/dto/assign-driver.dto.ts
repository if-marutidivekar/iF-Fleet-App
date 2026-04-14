import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignDriverDto {
  @ApiProperty({ example: 'driver-profile-uuid', description: 'DriverProfile.id to assign' })
  @IsString()
  @IsNotEmpty()
  driverProfileId!: string;
}
