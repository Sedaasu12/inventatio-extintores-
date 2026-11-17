import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth/public.decorator';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';

interface HealthResponse {
  status: 'ok';
  service: string;
  environment: string;
  timestamp: string;
  uptimeSeconds: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(APP_ENV) private readonly env: AppEnv) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Estado del servicio' })
  @ApiOkResponse({
    description: 'El servicio está en ejecución.',
    schema: {
      type: 'object',
      required: [
        'status',
        'service',
        'environment',
        'timestamp',
        'uptimeSeconds',
      ],
      properties: {
        status: { type: 'string', example: 'ok' },
        service: { type: 'string', example: 'site-backend' },
        environment: { type: 'string', example: 'development' },
        timestamp: { type: 'string', format: 'date-time' },
        uptimeSeconds: { type: 'number', example: 12 },
      },
    },
  })
  check(): HealthResponse {
    return {
      status: 'ok',
      service: 'site-backend',
      environment: this.env.nodeEnv,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
    };
  }
}
