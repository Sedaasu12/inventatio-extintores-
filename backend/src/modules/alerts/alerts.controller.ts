import { Body, Controller, Get, Param, Put, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator';
import type { RequestContext } from '../auth/auth.service';
import { AlertsService } from './alerts.service';
import {
  AlertSummaryQueryDto,
  ListAlertsQueryDto,
  UpdateAlertSettingDto,
} from './dto/alerts.dto';

type RequestWithId = Request & { requestId?: string };

@ApiTags('alerts')
@ApiBearerAuth()
@Controller()
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('alerts')
  @RequirePermissions('alerts.read')
  @ApiOperation({ summary: 'Lista alertas calculadas por activo y categoría' })
  list(@Query() query: ListAlertsQueryDto) {
    return this.alertsService.list(query);
  }

  @Get('alerts/summary')
  @RequirePermissions('alerts.read')
  @ApiOperation({ summary: 'Resumen de alertas por categoría y estado' })
  summary(@Query() query: AlertSummaryQueryDto) {
    return this.alertsService.summary(query);
  }

  @Get('alert-settings')
  @RequirePermissions('alerts.read')
  @ApiOperation({ summary: 'Consulta los umbrales de alerta configurados' })
  getSettings() {
    return this.alertsService.getSettings();
  }

  @Put('alert-settings/:eventType')
  @RequirePermissions('alerts.settings')
  @ApiOperation({ summary: 'Configura el umbral de una categoría de alerta' })
  updateSetting(
    @Param('eventType') eventType: string,
    @Body() dto: UpdateAlertSettingDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.alertsService.updateSetting(
      eventType,
      dto,
      actor,
      this.context(request),
    );
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
