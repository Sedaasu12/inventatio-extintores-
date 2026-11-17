import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
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
  ChangeConditionDto,
  CreateExtinguisherDto,
  ListExtinguishersQueryDto,
  QrQueryDto,
  UpdateExtinguisherDto,
} from './dto/extinguishers.dto';
import { ExtinguishersService } from './extinguishers.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('extinguishers')
@ApiBearerAuth()
@Controller('extinguishers')
export class ExtinguishersController {
  constructor(private readonly extinguishersService: ExtinguishersService) {}

  @Get()
  @RequirePermissions('extinguishers.read')
  @ApiOperation({ summary: 'Lista paginada de extintores con filtros' })
  list(@Query() query: ListExtinguishersQueryDto) {
    return this.extinguishersService.list(query);
  }

  @Post()
  @RequirePermissions('extinguishers.create')
  @ApiOperation({
    summary: 'Alta transaccional con INGRESO inicial e idempotencia',
  })
  async create(
    @Body() dto: CreateExtinguisherDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (idempotencyKey === undefined || idempotencyKey.trim() === '') {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El encabezado Idempotency-Key es obligatorio para dar de alta un extintor.',
        { field: 'Idempotency-Key' },
      );
    }

    const result = await this.extinguishersService.create(
      dto,
      actor,
      idempotencyKey,
      this.context(request),
    );

    if (result.replayed) {
      response.setHeader('Idempotent-Replay', 'true');
      response.status(200);
    }
    return result.body;
  }

  @Get('by-code/:assetCode')
  @RequirePermissions('extinguishers.read')
  @ApiOperation({ summary: 'Resuelve un extintor por su código QR o manual' })
  getByCode(
    @Param('assetCode') assetCode: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.extinguishersService.getByCode(assetCode, actor, request.ip);
  }

  @Get(':id')
  @RequirePermissions('extinguishers.read')
  @ApiOperation({ summary: 'Ficha completa del extintor' })
  get(@Param('id') id: string) {
    return this.extinguishersService.get(id);
  }

  @Patch(':id')
  @RequirePermissions('extinguishers.update')
  @ApiOperation({
    summary: 'Edita campos descriptivos y técnicos con rowVersion',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateExtinguisherDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.extinguishersService.update(
      id,
      dto,
      actor,
      this.context(request),
    );
  }

  @Post(':id/condition')
  @HttpCode(200)
  @RequirePermissions('extinguishers.condition')
  @ApiOperation({
    summary: 'Cambia la condición técnica con motivo (SEGURIDAD/ADMIN)',
  })
  changeCondition(
    @Param('id') id: string,
    @Body() dto: ChangeConditionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.extinguishersService.changeCondition(
      id,
      dto,
      actor,
      this.context(request),
    );
  }

  @Get(':id/qr')
  @RequirePermissions('extinguishers.read')
  @ApiOperation({ summary: 'QR PNG o SVG con el código del activo' })
  async qr(
    @Param('id') id: string,
    @Query() query: QrQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const result = await this.extinguishersService.renderQr(
      id,
      query.format ?? 'png',
      query.size ?? 256,
    );
    response.setHeader('Content-Type', result.contentType);
    response.send(result.body);
  }

  @Get(':id/label')
  @RequirePermissions('extinguishers.read')
  @ApiOperation({ summary: 'Etiqueta HTML imprimible con QR y código' })
  async label(
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const html = await this.extinguishersService.renderLabel(id);
    response.type('text/html; charset=utf-8').send(html);
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
