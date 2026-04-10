import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectBookingDto {
  @ApiProperty({ example: 'No vehicles available for that date' })
  @IsString()
  @IsNotEmpty()
  rejectionReason!: string;
}
