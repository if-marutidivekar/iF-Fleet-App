import { Controller, Get, Patch, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications (last 50)' })
  list(@Request() req: { user: { id: string } }) {
    return this.notificationsService.listForUser(req.user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.notificationsService.markRead(id, req.user.id);
  }
}
