import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { StartTripDto } from './dto/start-trip.dto';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { AddFuelLogDto } from './dto/add-fuel-log.dto';
import { LogLocationDto } from './dto/log-location.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@if-fleet/domain';

interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
}

@ApiTags('Trips')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'trips', version: '1' })
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post(':assignmentId/start')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver starts a trip for an assignment' })
  startTrip(
    @Param('assignmentId') assignmentId: string,
    @Body() dto: StartTripDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tripsService.startTrip(assignmentId, dto, user.sub);
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Driver completes the trip' })
  completeTrip(
    @Param('id') id: string,
    @Body() dto: CompleteTripDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tripsService.completeTrip(id, dto, user.sub, user.role);
  }

  @Get()
  @ApiOperation({ summary: 'List trips (admin: all, driver: own)' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.tripsService.findAll(user.sub, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Trip detail with location logs' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.tripsService.findOne(id, user.sub, user.role);
  }

  @Post(':id/fuel')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Add fuel log to trip' })
  addFuelLog(
    @Param('id') id: string,
    @Body() dto: AddFuelLogDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.tripsService.addFuelLog(id, dto, user.sub);
  }
}
