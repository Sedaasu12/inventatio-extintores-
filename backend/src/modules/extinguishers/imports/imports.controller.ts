import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { RequirePermissions } from '../../../common/auth/require-permissions.decorator';
import type { RequestContext } from '../../auth/auth.service';
import { MAX_IMPORT_FILE_BYTES, ImportFormat } from './import-file';
import { ConfirmImportDto, DryRunImportDto } from './dto/imports.dto';
import type { UploadedImportFile } from './imports.service';
import { ExtinguisherImportsService } from './imports.service';

type RequestWithId = Request & { requestId?: string };

const FILE_LIMITS = {
  fileSize: MAX_IMPORT_FILE_BYTES,
  files: 1,
  fields: 10,
} as const;

const COMMON_BODY_PROPERTIES = {
  file: {
    type: 'string',
    format: 'binary',
    description: 'Archivo CSV o JSON con las filas de la carga inicial.',
  },
  format: { type: 'string', enum: Object.values(ImportFormat) },
  receivedBy: { type: 'string', example: 'Carlos Ruiz' },
  documentRef: { type: 'string', example: 'ACTA-CARGA-2026-001' },
  reason: {
    type: 'string',
    example: 'Carga inicial conciliada con verificación física',
  },
} as const;

@ApiTags('extinguishers')
@ApiBearerAuth()
@Controller('extinguishers/imports')
export class ExtinguisherImportsController {
  constructor(private readonly importsService: ExtinguisherImportsService) {}

  @Post('dry-run')
  @HttpCode(200)
  @RequirePermissions('extinguishers.create')
  @UseInterceptors(FileInterceptor('file', { limits: FILE_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'format', 'receivedBy', 'documentRef', 'reason'],
      properties: COMMON_BODY_PROPERTIES,
    },
  })
  @ApiOperation({
    summary: 'Valida un archivo de carga inicial sin escribir datos',
  })
  dryRun(
    @UploadedFile() file: UploadedImportFile | undefined,
    @Body() dto: DryRunImportDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.importsService.dryRun(file, dto, actor);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions('extinguishers.create')
  @UseInterceptors(FileInterceptor('file', { limits: FILE_LIMITS }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'file',
        'format',
        'receivedBy',
        'documentRef',
        'reason',
        'dryRunToken',
      ],
      properties: {
        ...COMMON_BODY_PROPERTIES,
        dryRunToken: {
          type: 'string',
          description:
            'Comprobante devuelto por el dry-run del mismo archivo y datos.',
        },
      },
    },
  })
  @ApiOperation({
    summary:
      'Confirma la carga inicial con el comprobante de un dry-run previo',
  })
  confirm(
    @UploadedFile() file: UploadedImportFile | undefined,
    @Body() dto: ConfirmImportDto,
    @CurrentUser() actor: AuthenticatedUser,
    @Req() request: RequestWithId,
  ) {
    return this.importsService.confirm(file, dto, actor, this.context(request));
  }

  private context(request: RequestWithId): RequestContext {
    return {
      ip: request.ip,
      userAgent: request.header('user-agent'),
      requestId: request.requestId,
    };
  }
}
