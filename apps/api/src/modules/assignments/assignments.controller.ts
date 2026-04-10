import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { DeclineAssignmentDto } from './dto/decline-assignment.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@if-fleet/domain';

interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
}

class ReassignAssignmentDto {
  @IsString()
  @IsNotEmpty()
  vehicleId!: string;

  @IsString()
  @IsNotEmpty()
  driverId!: string;
}

@ApiTags('Assignments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'assignments', version: '1' })
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin assigns vehicle + driver to approved booking' })
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() user: JwtUser) {
    return this.assignmentsService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List assignments (admin: all, driver: own)' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.assignmentsService.findAll(user.sub, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get assignment by id' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.assignmentsService.findOne(id, user.sub, user.role);
  }

  @Post(':id/accept')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver accepts assignment' })
  accept(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.assignmentsService.accept(id, user.sub);
  }

  @Post(':id/decline')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Driver declines assignment with reason' })
  decline(
    @Param('id') id: string,
    @Body() dto: DeclineAssignmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.assignmentsService.decline(id, user.sub, dto.declineReason);
  }

  @Patch(':id/reassign')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin reassigns vehicle/driver for an assignment' })
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignAssignmentDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.assignmentsService.reassign(id, dto.vehicleId, dto.driverId, user.sub);
  }
}
