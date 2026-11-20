import { Module } from '@nestjs/common';
import { ExtinguishersModule } from '../extinguishers/extinguishers.module';
import { InspectionsModule } from '../inspections/inspections.module';
import { MovementsModule } from '../movements/movements.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ExtinguishersModule, MovementsModule, InspectionsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
