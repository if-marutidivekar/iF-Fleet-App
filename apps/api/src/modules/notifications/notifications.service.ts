import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    if (notification.recipientId !== userId) {
      throw new ForbiddenException('Not your notification');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
        deliveryState: 'READ',
      },
    });
  }
}
