import { Module } from '@nestjs/common';
import { ExtinguishersController } from './extinguishers.controller';
import { ExtinguishersService } from './extinguishers.service';
import { ExtinguisherQrService } from './extinguisher-qr.service';
import { QrRateLimiter } from './qr-rate-limiter';
import { ExtinguisherImportsController } from './imports/imports.controller';
import { ExtinguisherImportsService } from './imports/imports.service';

@Module({
  controllers: [ExtinguishersController, ExtinguisherImportsController],
  providers: [
    ExtinguishersService,
    ExtinguisherQrService,
    QrRateLimiter,
    ExtinguisherImportsService,
  ],
  exports: [ExtinguishersService],
})
export class ExtinguishersModule {}
