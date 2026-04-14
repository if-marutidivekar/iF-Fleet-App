import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FleetService } from './fleet.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { SetLocationDto } from './dto/set-location.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@if-fleet/domain';

@ApiTags('Fleet')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'fleet', version: '1' })
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  // ── Vehicles ──────────────────────────────────────────────────────────────

  @Get('vehicles')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all vehicles (admin)' })
  listVehicles() {
    return this.fleetService.listVehicles();
  }

  @Post('vehicles')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create vehicle (admin)' })
  createVehicle(@Body() dto: CreateVehicleDto) {
    return this.fleetService.createVehicle(dto);
  }

  // IMPORTANT: static paths must come before ':id' param routes
  @Get('vehicles/available-with-driver')
  @ApiOperation({ summary: 'List vehicles that have an assigned & located driver (any auth)' })
  listAvailableWithDriver() {
    return this.fleetService.listAvailableWithDriver();
  }

  @Patch('vehicles/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update vehicle (admin)' })
  updateVehicle(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.fleetService.updateVehicle(id, dto);
  }

  @Patch('vehicles/:id/assign-driver')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Assign a driver to a vehicle (admin)' })
  assignDriver(
    @Param('id') id: string,
    @Body() dto: AssignDriverDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.fleetService.assignDriver(id, dto, req.user.id);
  }

  @Patch('vehicles/:id/unassign-driver')
  @Roles(UserRole.ADMIN, UserRole.DRIVER)
  @ApiOperation({ summary: 'Unassign driver from vehicle (admin or assigned driver)' })
  unassignDriver(
    @Param('id') id: string,
    @Request() req: { user: { id: string; role: UserRole } },
  ) {
    return this.fleetService.unassignDriver(id, req.user.id, req.user.role);
  }

  // ── Driver Profiles ───────────────────────────────────────────────────────

  @Get('drivers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all driver profiles (admin)' })
  listDrivers() {
    return this.fleetService.listDrivers();
  }

  @Post('drivers')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create driver profile (admin)' })
  createDriver(@Body() dto: CreateDriverDto) {
    return this.fleetService.createDriver(dto);
  }

  // IMPORTANT: 'my-location' must be declared BEFORE ':id' to avoid param conflict
  @Patch('drivers/my-location')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver sets own current location (preset or free-text)' })
  setMyLocation(
    @Body() dto: SetLocationDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.fleetService.setDriverLocation(req.user.id, dto);
  }

  @Patch('drivers/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update driver profile (admin)' })
  updateDriver(@Param('id') id: string, @Body() dto: UpdateDriverDto) {
    return this.fleetService.updateDriver(id, dto);
  }

  // ── Preset Locations ──────────────────────────────────────────────────────

  @Get('locations')
  @ApiOperation({ summary: 'List preset locations (all authenticated)' })
  listLocations(@Query('activeOnly') activeOnly?: string) {
    return this.fleetService.listLocations(activeOnly === 'true');
  }

  @Post('locations')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create preset location (admin)' })
  createLocation(@Body() dto: CreateLocationDto) {
    return this.fleetService.createLocation(dto);
  }

  @Patch('locations/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update/toggle preset location (admin)' })
  updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.fleetService.updateLocation(id, dto);
  }
}
