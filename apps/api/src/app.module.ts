import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { FleetModule } from './modules/fleet/fleet.module';
import { LocationsModule } from './modules/locations/locations.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { TripsModule } from './modules/trips/trips.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AdminModule } from './modules/admin/admin.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './common/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    FleetModule,
    LocationsModule,
    BookingsModule,
    AssignmentsModule,
    TripsModule,
    TrackingModule,
    NotificationsModule,
    AdminModule,
    ReportingModule,
  ],
})
export class AppModule {}
