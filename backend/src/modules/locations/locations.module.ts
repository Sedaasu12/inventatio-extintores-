import { Module } from '@nestjs/common';
import { CodeCounterService } from '../../common/codes/code-counter.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  controllers: [LocationsController],
  providers: [LocationsService, CodeCounterService],
  exports: [LocationsService],
})
export class LocationsModule {}
