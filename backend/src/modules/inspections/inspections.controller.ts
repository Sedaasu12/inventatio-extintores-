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
  CreateInspectionDto,
  ListInspectionsQueryDto,
} from './dto/inspection.dto';
import { InspectionsService } from './inspections.service';

type RequestWithId = Request & { requestId?: string };

@ApiTags('inspections')
@ApiBearerAuth()
@Controller()
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  @Get('inspections')
  @RequirePermissions('inspections.read')
  @ApiOperation({ summary: 'Lista inspecciones con filtros' })
  list(@Query() query: ListInspectionsQueryDto) {
    return this.inspectionsService.list(query);
  }

  @Get('inspections/:id')
  @RequirePermissions('inspections.read')
  @ApiOperation({ summary: 'Detalle de una inspección' })
  get(@Param('id') id: string) {
    return this.inspectionsService.get(id);
  }

  @Post('extinguishers/:id/inspections')
  @HttpCode(201)
  @RequirePermissions('inspections.create')
  @ApiOperation({
    summary: 'Registra una inspección y actualiza la fecha objetivo',
  })
  async create(
    @Param('id') id: string,
    @Body() dto: CreateInspectionDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Req() request: RequestWithId,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.inspectionsService.create(
      id,
      dto,
      actor,
      this.requireIdempotencyKey(idempotencyKey),
      this.context(request),
    );
    if (result.replayed) {
      response.setHeader('Idempotent-Replay', 'true');
      response.status(200);
    }
    return result.body;
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

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
