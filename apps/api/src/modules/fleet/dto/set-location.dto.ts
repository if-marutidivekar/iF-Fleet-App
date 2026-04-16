import { IsString, IsOptional, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SetLocationDto {
  @ApiPropertyOptional({ example: 'preset-location-uuid', description: 'Preset location ID' })
  @IsOptional()
  @IsString()
  presetId?: string;

  @ApiPropertyOptional({ example: '45 Marine Lines, Mumbai', description: 'Free-text address if no preset' })
  @ValidateIf((o: SetLocationDto) => !o.presetId)
  @IsString()
  customAddress?: string;
}
