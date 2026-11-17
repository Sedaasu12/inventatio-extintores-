import { Module } from '@nestjs/common';
import { ExtinguishersController } from './extinguishers.controller';
import { ExtinguishersService } from './extinguishers.service';
import { ExtinguisherQrService } from './extinguisher-qr.service';
import { QrRateLimiter } from './qr-rate-limiter';

@Module({
  controllers: [ExtinguishersController],
  providers: [ExtinguishersService, ExtinguisherQrService, QrRateLimiter],
  exports: [ExtinguishersService],
})
export class ExtinguishersModule {}
