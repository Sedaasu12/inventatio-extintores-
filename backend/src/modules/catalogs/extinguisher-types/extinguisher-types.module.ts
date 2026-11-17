import { Module } from '@nestjs/common';
import { ExtinguisherTypesController } from './extinguisher-types.controller';
import { ExtinguisherTypesService } from './extinguisher-types.service';
import { EquipmentDueDatesService } from './equipment-due-dates.service';

@Module({
  controllers: [ExtinguisherTypesController],
  providers: [ExtinguisherTypesService, EquipmentDueDatesService],
  exports: [ExtinguisherTypesService, EquipmentDueDatesService],
})
export class ExtinguisherTypesModule {}
