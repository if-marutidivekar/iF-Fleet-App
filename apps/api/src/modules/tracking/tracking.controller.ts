import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@if-fleet/domain';
import { TripsService } from '../trips/trips.service';
import { LogLocationDto } from '../trips/dto/log-location.dto';

interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
}

@ApiTags('Tracking')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'tracking', version: '1' })
export class TrackingController {
  constructor(private readonly tripsService: TripsService) {}

  @Post(':tripId/location')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver posts GPS location for a trip' })
  logLocation(
    @Param('tripId') tripId: string,
    @Body() dto: LogLocationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tripsService.logLocation(tripId, dto, user.id);
  }
}
