import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TripsModule } from '../trips/trips.module';

@Module({
  imports: [TripsModule],
  controllers: [TrackingController],
})
export class TrackingModule {}
