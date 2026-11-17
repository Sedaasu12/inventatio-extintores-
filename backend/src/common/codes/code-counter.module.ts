import { Global, Module } from '@nestjs/common';
import { CodeCounterService } from './code-counter.service';

@Global()
@Module({
  providers: [CodeCounterService],
  exports: [CodeCounterService],
})
export class CodeCounterModule {}
