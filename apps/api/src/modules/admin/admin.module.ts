import { Module, forwardRef } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MailModule } from '../mail/mail.module';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, MailModule, forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
