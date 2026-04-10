import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeclineAssignmentDto {
  @ApiProperty({ example: 'Vehicle breakdown' })
  @IsString()
  @IsNotEmpty()
  declineReason!: string;
}
