import { Inject, Injectable } from '@nestjs/common';
import { EntrySource } from '@prisma/client';
import { ApiError } from '../../../common/errors/api-error';
import { ErrorCodes } from '../../../common/errors/error-codes';
import { APP_ENV } from '../../../config/config.module';
import type { AppEnv } from '../../../config/env';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { AuditService } from '../../audit/audit.service';
import type { RequestContext } from '../../auth/auth.service';
import { ExtinguishersService } from '../extinguishers.service';
import type { CreateExtinguisherDto } from '../dto/extinguishers.dto';
import { MAX_IMPORT_FILE_BYTES, parseImportFile } from './import-file';
import type { RawImportRow } from './import-file';
import {
  applySerialWarnings,
  buildImportCatalogs,
  buildImportSummary,
  validateImportRows,
} from './import-validation';
import type {
  ImportSummary,
  NormalizedImportRow,
  ResolvedImportRow,
  RowIssue,
  SerialWarningResult,
  ValidatedImportRow,
} from './import-validation';
import {
  computeImportRequestHash,
  createDryRunToken,
  verifyDryRunToken,
} from './import-token';
import type { ConfirmImportDto, DryRunImportDto } from './dto/imports.dto';

export interface UploadedImportFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

export interface DryRunRowReport {
  row: number;
  line: number;
  status: 'VALID' | 'INVALID';
  errors: RowIssue[];
  warnings: RowIssue[];
  data: NormalizedImportRow;
  resolved: ResolvedImportRow | null;
}

export interface DryRunReport {
  dryRunToken: string;
  expiresAt: string;
  summary: ImportSummary;
  rows: DryRunRowReport[];
}

export interface ConfirmRowReport {
  row: number;
  line: number;
  status: 'IMPORTED' | 'REPLAYED' | 'SKIPPED' | 'FAILED';
  serialNumber: string | null;
  assetCode: string | null;
  extinguisherId: string | null;
  errors: RowIssue[];
  warnings: RowIssue[];
}

export interface ConfirmSummary {
  totalRows: number;
  importedRows: number;
  replayedRows: number;
  skippedRows: number;
  failedRows: number;
  warningRows: number;
  bySede: ImportSummary['bySede'];
  byLocation: ImportSummary['byLocation'];
}

export interface ConfirmReport {
  dryRunId: string;
  summary: ConfirmSummary;
  rows: ConfirmRowReport[];
}

const SERIAL_QUERY_CHUNK = 500;

@Injectable()
export class ExtinguisherImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly extinguishers: ExtinguishersService,
    private readonly audit: AuditService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async dryRun(
    file: UploadedImportFile | undefined,
    dto: DryRunImportDto,
    actor: AuthenticatedUser,
  ): Promise<DryRunReport> {
    const buffer = this.requireFile(file);
    const parsed = parseImportFile({ format: dto.format, buffer });
    const rows = await this.validateRows(parsed.rows);
    const serials = await this.withSerialWarnings(rows);
    const summary = buildImportSummary(rows, serials);
    const requestHash = computeImportRequestHash({
      file: buffer,
      format: dto.format,
      receivedBy: dto.receivedBy,
      documentRef: dto.documentRef,
      reason: dto.reason,
    });
    const { token, expiresAt } = createDryRunToken(
      { requestHash, actorId: actor.id },
      this.env.jwtAccessSecret,
    );

    return {
      dryRunToken: token,
      expiresAt: expiresAt.toISOString(),
      summary,
      rows: rows.map((row) => ({
        row: row.row,
        line: row.line,
        status: row.status,
        errors: row.errors,
        warnings: row.warnings,
        data: row.data,
        resolved: row.resolved,
      })),
    };
  }

  async confirm(
    file: UploadedImportFile | undefined,
    dto: ConfirmImportDto,
    actor: AuthenticatedUser,
    context: RequestContext,
  ): Promise<ConfirmReport> {
    const buffer = this.requireFile(file);
    const requestHash = computeImportRequestHash({
      file: buffer,
      format: dto.format,
      receivedBy: dto.receivedBy,
      documentRef: dto.documentRef,
      reason: dto.reason,
    });
    const token = verifyDryRunToken(dto.dryRunToken, this.env.jwtAccessSecret);
    if (token === null) {
      throw ApiError.conflict(
        ErrorCodes.IMPORT_DRY_RUN_INVALID,
        'El comprobante de dry-run no es válido o expiró. Ejecuta nuevamente la previsualización.',
      );
    }
    if (token.actorId !== actor.id) {
      throw ApiError.conflict(
        ErrorCodes.IMPORT_DRY_RUN_INVALID,
        'El comprobante de dry-run pertenece a otro usuario.',
      );
    }
    if (token.requestHash !== requestHash) {
      throw ApiError.conflict(
        ErrorCodes.IMPORT_DRY_RUN_INVALID,
        'El archivo o los datos comunes cambiaron desde el dry-run. Ejecuta nuevamente la previsualización.',
      );
    }

    const parsed = parseImportFile({ format: dto.format, buffer });
    const rows = await this.validateRows(parsed.rows);
    const serials = await this.withSerialWarnings(rows);

    const results: ConfirmRowReport[] = [];
    for (const row of rows) {
      if (row.status === 'INVALID') {
        results.push({
          row: row.row,
          line: row.line,
          status: 'SKIPPED',
          serialNumber: row.data.serialNumber,
          assetCode: null,
          extinguisherId: null,
          errors: row.errors,
          warnings: row.warnings,
        });
        continue;
      }

      if (
        row.resolved === null ||
        row.data.capacityValue === null ||
        row.data.capacityUnit === null ||
        row.data.technicalCondition === null
      ) {
        results.push({
          row: row.row,
          line: row.line,
          status: 'FAILED',
          serialNumber: row.data.serialNumber,
          assetCode: null,
          extinguisherId: null,
          errors: [
            {
              code: 'ROW_INCOMPLETE',
              message:
                'La fila quedó incompleta después de la validación. Ejecuta nuevamente el dry-run.',
            },
          ],
          warnings: row.warnings,
        });
        continue;
      }

      const payload: CreateExtinguisherDto = {
        serialNumber: row.data.serialNumber,
        typeId: row.resolved.typeId,
        brand: row.data.brand,
        model: row.data.model,
        capacityValue: row.data.capacityValue,
        capacityUnit: row.data.capacityUnit,
        manufactureDate: row.data.manufactureDate,
        acquiredAt: row.data.acquiredAt,
        commissionedAt: row.data.commissionedAt,
        manufacturerExpiryDate: row.data.manufacturerExpiryDate,
        initialLocationId: row.resolved.locationId,
        entrySource: EntrySource.CARGA_INICIAL,
        initialReason: dto.reason,
        receivedBy: dto.receivedBy,
        documentRef: dto.documentRef,
        technicalCondition: row.data.technicalCondition,
        notes: row.data.notes,
      };

      try {
        const result = await this.extinguishers.create(
          payload,
          actor,
          `imp:${token.jti}:${row.row}`,
          context,
        );
        results.push({
          row: row.row,
          line: row.line,
          status: result.replayed ? 'REPLAYED' : 'IMPORTED',
          serialNumber: row.data.serialNumber,
          assetCode: result.body.assetCode,
          extinguisherId: result.body.id,
          errors: [],
          warnings: row.warnings,
        });
      } catch (error) {
        const issue: RowIssue =
          error instanceof ApiError
            ? { code: error.code, message: error.message }
            : {
                code: 'ROW_FAILED',
                message: 'No se pudo importar la fila.',
              };
        results.push({
          row: row.row,
          line: row.line,
          status: 'FAILED',
          serialNumber: row.data.serialNumber,
          assetCode: null,
          extinguisherId: null,
          errors: [issue],
          warnings: row.warnings,
        });
      }
    }

    const summary = this.buildConfirmSummary(rows, serials, results);

    await this.audit.record({
      actorUserId: actor.id,
      actorLabel: actor.fullName,
      action: 'EXTINGUISHERS_IMPORTED',
      entityType: 'EXTINGUISHER_IMPORT',
      entityId: token.jti,
      afterData: {
        dryRunId: token.jti,
        fileName: file?.originalname.slice(0, 255) ?? null,
        format: dto.format,
        totalRows: summary.totalRows,
        importedRows: summary.importedRows,
        replayedRows: summary.replayedRows,
        skippedRows: summary.skippedRows,
        failedRows: summary.failedRows,
        warningRows: summary.warningRows,
      },
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      requestId: context.requestId ?? null,
    });

    return { dryRunId: token.jti, summary, rows: results };
  }

  private requireFile(file: UploadedImportFile | undefined): Buffer {
    if (file === undefined || file.size === 0 || file.buffer.length === 0) {
      throw ApiError.unprocessable(
        ErrorCodes.IMPORT_FILE_INVALID,
        'Adjunta un archivo CSV o JSON en el campo "file".',
        { field: 'file' },
      );
    }
    if (file.buffer.length > MAX_IMPORT_FILE_BYTES) {
      throw ApiError.unprocessable(
        ErrorCodes.IMPORT_FILE_INVALID,
        'El archivo supera el tamaño máximo permitido.',
        { field: 'file', maxBytes: MAX_IMPORT_FILE_BYTES },
      );
    }
    return file.buffer;
  }

  private async validateRows(
    rawRows: RawImportRow[],
  ): Promise<ValidatedImportRow[]> {
    const [types, locations] = await Promise.all([
      this.prisma.extinguisherType.findMany({
        select: {
          id: true,
          code: true,
          active: true,
          usefulLifeYears: true,
        },
      }),
      this.prisma.location.findMany({
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          active: true,
          parentId: true,
        },
      }),
    ]);
    return validateImportRows(
      rawRows,
      buildImportCatalogs(types, locations),
      this.env.timezone,
    );
  }

  private async withSerialWarnings(
    rows: ValidatedImportRow[],
  ): Promise<SerialWarningResult> {
    const serials = [
      ...new Set(
        rows
          .map((row) => row.data.serialNumber)
          .filter((serial): serial is string => serial !== null)
          .map((serial) => serial.toUpperCase()),
      ),
    ];
    const existing = new Map<string, string[]>();

    for (let index = 0; index < serials.length; index += SERIAL_QUERY_CHUNK) {
      const chunk = serials.slice(index, index + SERIAL_QUERY_CHUNK);
      const found = await this.prisma.extinguisher.findMany({
        where: { serialNumber: { in: chunk } },
        select: { serialNumber: true, assetCode: true },
      });
      for (const item of found) {
        if (item.serialNumber === null) {
          continue;
        }
        const key = item.serialNumber.toUpperCase();
        const assetCodes = existing.get(key) ?? [];
        assetCodes.push(item.assetCode);
        existing.set(key, assetCodes);
      }
    }

    return applySerialWarnings(rows, existing);
  }

  private buildConfirmSummary(
    rows: ValidatedImportRow[],
    serials: SerialWarningResult,
    results: ConfirmRowReport[],
  ): ConfirmSummary {
    const base = buildImportSummary(rows, serials);
    return {
      totalRows: base.totalRows,
      importedRows: results.filter((row) => row.status === 'IMPORTED').length,
      replayedRows: results.filter((row) => row.status === 'REPLAYED').length,
      skippedRows: results.filter((row) => row.status === 'SKIPPED').length,
      failedRows: results.filter((row) => row.status === 'FAILED').length,
      warningRows: base.warningRows,
      bySede: base.bySede,
      byLocation: base.byLocation,
    };
  }
}
