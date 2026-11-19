import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../common/auth/require-permissions.decorator';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import type { RequestContext } from '../auth/auth.service';
import {
  CreateServiceDto,
  ListMaintenanceOrdersQueryDto,
  ReturnFromMaintenanceDto,
  SendToMaintenanceDto,
} from './dto/maintenance.dto';
import { MaintenanceService } from './maintenance.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('maintenance')
@ApiBearerAuth()
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get('maintenance-orders')
  @RequirePermissions('maintenance.read')
  @ApiOperation({ summary: 'Lista órdenes de mantenimiento con filtros' })
  list(@Query() query: ListMaintenanceOrdersQueryDto) {
    return this.maintenanceService.list(query);
  }

  @Get('maintenance-orders/:id')
  @RequirePermissions('maintenance.read')
  @ApiOperation({ summary: 'Detalle de orden con servicios' })
  get(@Param('id') id: string) {
    return this.maintenanceService.get(id);
  }

  @Post('extinguishers/:id/maintenance/send')
  @HttpCode(201)
  @RequirePermissions('maintenance.manage')
  @ApiOperation({
    summary: 'Envía el extintor a mantenimiento externo o interno',
  })
  async send(
    @Param('id') id: string,
    @Body() dto: SendToMaintenanceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.maintenanceService.sendToMaintenance(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result.replayed, result.body, response);
  }

  @Post('maintenance-orders/:id/services')
  @HttpCode(201)
  @RequirePermissions('maintenance.manage')
  @ApiOperation({ summary: 'Registra un servicio dentro de una orden' })
  async registerService(
    @Param('id') id: string,
    @Body() dto: CreateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.maintenanceService.registerOrderService(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result.replayed, result.service, response);
  }

  @Post('extinguishers/:id/services')
  @HttpCode(201)
  @RequirePermissions('maintenance.manage')
  @ApiOperation({ summary: 'Registra un servicio interno sin orden' })
  async registerStandaloneService(
    @Param('id') id: string,
    @Body() dto: CreateServiceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.maintenanceService.registerStandaloneService(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result.replayed, result.service, response);
  }

  @Post('maintenance-orders/:id/return')
  @HttpCode(201)
  @RequirePermissions('maintenance.manage')
  @ApiOperation({ summary: 'Registra el retorno y cierra la orden' })
  async returnFromMaintenance(
    @Param('id') id: string,
    @Body() dto: ReturnFromMaintenanceDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.maintenanceService.returnFromMaintenance(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result.replayed, result.body, response);
  }

  private requireIdempotencyKey(value: string | undefined): string {
    if (value === undefined || value.trim() === '') {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El encabezado Idempotency-Key es obligatorio para esta operación.',
        { field: 'Idempotency-Key' },
      );
    }
    return value;
  }

  private respond<T>(replayed: boolean, body: T, response: Response): T {
    if (replayed) {
      response.setHeader('Idempotent-Replay', 'true');
      response.status(200);
    }
    return body;
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
