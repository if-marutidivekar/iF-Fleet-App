import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { RejectBookingDto } from './dto/reject-booking.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@if-fleet/domain';

interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
}

@ApiTags('Bookings')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'bookings', version: '1' })
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create booking (employee/admin)' })
  create(@Body() dto: CreateBookingDto, @CurrentUser() user: JwtUser) {
    return this.bookingsService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List bookings (admin: all, employee: own)' })
  findAll(@CurrentUser() user: JwtUser) {
    return this.bookingsService.findAll(user.id, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking detail' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.bookingsService.findOne(id, user.id, user.role);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin approves booking' })
  approve(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.bookingsService.approve(id, user.id);
  }

  @Patch(':id/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin rejects booking with reason' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectBookingDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.bookingsService.reject(id, user.id, dto.rejectionReason);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel booking (requester or admin)' })
  cancel(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.bookingsService.cancel(id, user.id, user.role);
  }
}
