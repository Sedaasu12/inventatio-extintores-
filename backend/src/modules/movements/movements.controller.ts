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
  AdjustMovementDto,
  CreateMovementDto,
  ListMovementsQueryDto,
  RetireExtinguisherDto,
} from './dto/movements.dto';
import { MovementsService } from './movements.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('movements')
@ApiBearerAuth()
@Controller()
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get('movements')
  @RequirePermissions('movements.read')
  @ApiOperation({ summary: 'Historial global de movimientos con filtros' })
  list(@Query() query: ListMovementsQueryDto) {
    return this.movementsService.list(query);
  }

  @Get('movements/:id')
  @RequirePermissions('movements.read')
  @ApiOperation({ summary: 'Detalle inmutable de un movimiento' })
  get(@Param('id') id: string) {
    return this.movementsService.get(id);
  }

  @Get('extinguishers/:id/movements')
  @RequirePermissions('movements.read')
  @ApiOperation({ summary: 'Historial de un extintor' })
  listByExtinguisher(
    @Param('id') id: string,
    @Query() query: ListMovementsQueryDto,
  ) {
    return this.movementsService.listByExtinguisher(id, query);
  }

  @Post('extinguishers/:id/movements')
  @HttpCode(201)
  @RequirePermissions('movements.create')
  @ApiOperation({ summary: 'Registra SALIDA, TRASLADO o RETORNO_ALMACEN' })
  async create(
    @Param('id') id: string,
    @Body() dto: CreateMovementDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.movementsService.createMovement(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result, response);
  }

  @Post('extinguishers/:id/retire')
  @HttpCode(201)
  @RequirePermissions('extinguishers.retire')
  @ApiOperation({ summary: 'Da de baja el extintor con evidencia obligatoria' })
  async retire(
    @Param('id') id: string,
    @Body() dto: RetireExtinguisherDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.movementsService.retire(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result, response);
  }

  @Post('extinguishers/:id/adjustments')
  @HttpCode(201)
  @RequirePermissions('movements.adjust')
  @ApiOperation({ summary: 'Ajuste excepcional de colocación (ADMIN)' })
  async adjust(
    @Param('id') id: string,
    @Body() dto: AdjustMovementDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.movementsService.adjust(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    return this.respond(result, response);
  }

  private requireIdempotencyKey(value: string | undefined): string {
    if (value === undefined || value.trim() === '') {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El encabezado Idempotency-Key es obligatorio para registrar movimientos.',
        { field: 'Idempotency-Key' },
      );
    }
    return value;
  }

  private respond(
    result: {
      replayed: boolean;
      body: {
        movement: unknown;
        extinguisher: unknown;
      };
    },
    response: Response,
  ) {
    if (result.replayed) {
      response.setHeader('Idempotent-Replay', 'true');
      response.status(200);
    }
    return result.body;
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
