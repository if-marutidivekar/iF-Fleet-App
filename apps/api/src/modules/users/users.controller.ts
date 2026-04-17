import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@if-fleet/domain';

interface JwtUser {
  id: string;
  email: string;
  role: UserRole;
}

class RegisterPushTokenDto {
  @IsString() @IsNotEmpty() pushToken!: string;
  @IsString() @IsIn(['ios', 'android', 'web']) deviceType!: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all users (admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get own user profile' })
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.findOne(user.id, user.id, user.role);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own profile (firstName, lastName, employeeId, department, mobileNumber)' })
  updateMe(@Body() dto: UpdateMyProfileDto, @CurrentUser() user: JwtUser) {
    return this.usersService.updateMyProfile(user.id, dto);
  }

  @Post('me/push-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Register or update device push notification token' })
  registerPushToken(@Body() dto: RegisterPushTokenDto, @CurrentUser() user: JwtUser) {
    return this.usersService.registerPushToken(user.id, dto.pushToken, dto.deviceType);
  }

  @Post('bulk-import')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Bulk create/update users from CSV text (admin only)' })
  bulkImport(@Body() body: { csvText: string }, @CurrentUser() actor: JwtUser) {
    if (!body?.csvText) {
      return { total: 0, created: 0, updated: 0, failed: 0, errors: [] };
    }
    return this.usersService.bulkImportCsv(body.csvText, actor.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id (admin or self)' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.findOne(id, user.id, user.role);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create user (admin only)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.create(dto, actor.id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.update(id, dto, actor.id);
  }
}
