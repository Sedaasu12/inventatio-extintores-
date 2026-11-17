import { Module } from '@nestjs/common';
import { ExternalPartiesController } from './external-parties.controller';
import { ExternalPartiesService } from './external-parties.service';

@Module({
  controllers: [ExternalPartiesController],
  providers: [ExternalPartiesService],
  exports: [ExternalPartiesService],
})
export class ExternalPartiesModule {}
