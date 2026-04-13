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
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@if-fleet/domain';

interface JwtUser {
  sub: string;
  email: string;
  role: UserRole;
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

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id (admin or self)' })
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    return this.usersService.findOne(id, user.sub, user.role);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create user (admin only)' })
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.create(dto, actor.sub);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update user (admin only)' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: JwtUser) {
    return this.usersService.update(id, dto, actor.sub);
  }
}
