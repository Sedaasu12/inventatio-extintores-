import { Inject, Injectable } from '@nestjs/common';
import { LogisticsStatus, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import {
  CodeCounterService,
  EXTINGUISHER_COUNTER,
} from '../../common/codes/code-counter.service';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import type { RequestContext } from '../auth/auth.service';
import { earliestEquipmentExpiry } from '../catalogs/extinguisher-types/equipment-due-dates.service';
import {
  CalendarDates,
  parseCalendarDate,
  todayInTimeZone,
  validateCalendarDates,
} from './extinguisher-dates';
import {
  EXTINGUISHER_BASE_SELECT,
  EXTINGUISHER_DETAIL_SELECT,
  toExtinguisherDetail,
  toExtinguisherView,
} from './extinguisher-view';
import { ExtinguisherQrService } from './extinguisher-qr.service';
import { QrRateLimiter } from './qr-rate-limiter';
import {
  ChangeConditionDto,
  CreateExtinguisherDto,
  ListExtinguishersQueryDto,
  UpdateExtinguisherDto,
} from './dto/extinguishers.dto';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 3;

type Tx = Prisma.TransactionClient;

export interface AltaResponse {
  id: string;
  assetCode: string;
  qrPayload: string;
  extinguisher: ReturnType<typeof toExtinguisherDetail>;
  movement: {
    id: string;
    type: string;
    assetSequence: number;
    movedAt: string;
  };
}

export interface AltaResult {
  status: number;
  replayed: boolean;
  body: AltaResponse;
}

function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function assetNotFound(): ApiError {
  return new ApiError(
    404,
    ErrorCodes.ASSET_NOT_FOUND,
    'El extintor no existe.',
  );
}

function hashPayload(dto: CreateExtinguisherDto): string {
  const canonical = JSON.stringify({
    serialNumber: dto.serialNumber ?? null,
    typeId: dto.typeId,
    brand: dto.brand ?? null,
    model: dto.model ?? null,
    capacityValue: dto.capacityValue,
    capacityUnit: dto.capacityUnit,
    manufactureDate: dto.manufactureDate ?? null,
    acquiredAt: dto.acquiredAt ?? null,
    commissionedAt: dto.commissionedAt ?? null,
    manufacturerExpiryDate: dto.manufacturerExpiryDate ?? null,
    initialLocationId: dto.initialLocationId,
    entrySource: dto.entrySource,
    initialReason: dto.initialReason,
    receivedBy: dto.receivedBy,
    documentRef: dto.documentRef,
    technicalCondition: dto.technicalCondition,
    notes: dto.notes ?? null,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

@Injectable()
export class ExtinguishersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly codeCounter: CodeCounterService,
    private readonly qrService: ExtinguisherQrService,
    private readonly qrRateLimiter: QrRateLimiter,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async list(query: ListExtinguishersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = await this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.extinguisher.findMany({
        where,
        select: EXTINGUISHER_BASE_SELECT,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.extinguisher.count({ where }),
    ]);

    return {
      data: rows.map((row) => toExtinguisherView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async get(id: string) {
    const row = await this.prisma.extinguisher.findUnique({
      where: { id },
      select: EXTINGUISHER_DETAIL_SELECT,
    });
    if (row === null) {
      throw assetNotFound();
    }
    return toExtinguisherDetail(row);
  }

  async getByCode(
    assetCode: string,
    actor: AuthenticatedUser,
    ip: string | undefined,
  ) {
    this.qrRateLimiter.assertAllowed(actor.id, ip);
    const row = await this.prisma.extinguisher.findUnique({
      where: { assetCode: assetCode.trim().toUpperCase() },
      select: EXTINGUISHER_DETAIL_SELECT,
    });
    if (row === null) {
      throw assetNotFound();
    }
    return toExtinguisherDetail(row);
  }

  async create(
    dto: CreateExtinguisherDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<AltaResult> {
    const key = idempotencyKey.trim();
    if (key.length === 0 || key.length > 64) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El encabezado Idempotency-Key es obligatorio y admite hasta 64 caracteres.',
        { field: 'Idempotency-Key' },
      );
    }

    const requestHash = hashPayload(dto);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);

    let outcome: { replayed: boolean; extinguisherId: string } | undefined;

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        outcome = await this.prisma.$transaction(
          (tx) =>
            this.createInTransaction(
              tx,
              dto,
              actor,
              key,
              requestHash,
              now,
              expiresAt,
              context,
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        break;
      } catch (error) {
        if (
          isRetryableTransactionError(error) &&
          attempt < MAX_TRANSACTION_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }

    if (outcome === undefined) {
      throw new ApiError(
        409,
        ErrorCodes.CONCURRENCY_CONFLICT,
        'No se pudo completar el alta por concurrencia. Intenta nuevamente.',
      );
    }

    const body = await this.buildAltaBody(outcome.extinguisherId);
    return {
      status: outcome.replayed ? 200 : 201,
      replayed: outcome.replayed,
      body,
    };
  }

  async update(
    id: string,
    dto: UpdateExtinguisherDto,
    actor: AuthenticatedUser,
    context: RequestContext,
  ) {
    const existing = await this.prisma.extinguisher.findUnique({
      where: { id },
      select: {
        id: true,
        assetCode: true,
        serialNumber: true,
        brand: true,
        model: true,
        capacityValue: true,
        capacityUnit: true,
        manufactureDate: true,
        acquiredAt: true,
        commissionedAt: true,
        manufacturerExpiryDate: true,
        notes: true,
        typeId: true,
        rowVersion: true,
      },
    });
    if (existing === null) {
      throw assetNotFound();
    }

    const dates = this.resolveDates(dto, existing);
    this.assertDates(dates);

    const typeId = dto.typeId ?? existing.typeId;
    const type = await this.prisma.extinguisherType.findUnique({
      where: { id: typeId },
      select: { active: true, usefulLifeYears: true },
    });
    if (type === null || !type.active) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El tipo de extintor no existe o está inactivo.',
        { field: 'typeId' },
      );
    }

    const data: Prisma.ExtinguisherUncheckedUpdateManyInput = {};
    if (dto.serialNumber !== undefined) {
      data.serialNumber = normalizeOptionalText(dto.serialNumber);
    }
    if (dto.typeId !== undefined) {
      data.typeId = dto.typeId;
    }
    if (dto.brand !== undefined) {
      data.brand = normalizeOptionalText(dto.brand);
    }
    if (dto.model !== undefined) {
      data.model = normalizeOptionalText(dto.model);
    }
    if (dto.capacityValue !== undefined) {
      data.capacityValue = dto.capacityValue.toFixed(2);
    }
    if (dto.capacityUnit !== undefined) {
      data.capacityUnit = dto.capacityUnit;
    }
    if (dto.manufactureDate !== undefined) {
      data.manufactureDate = dates.manufactureDate;
    }
    if (dto.acquiredAt !== undefined) {
      data.acquiredAt = dates.acquiredAt;
    }
    if (dto.commissionedAt !== undefined) {
      data.commissionedAt = dates.commissionedAt;
    }
    if (dto.manufacturerExpiryDate !== undefined) {
      data.manufacturerExpiryDate = dates.manufacturerExpiryDate;
    }
    if (dto.notes !== undefined) {
      data.notes = normalizeOptionalText(dto.notes);
    }

    if (Object.keys(data).length === 0) {
      if (existing.rowVersion !== dto.rowVersion) {
        throw new ApiError(
          409,
          ErrorCodes.CONCURRENCY_CONFLICT,
          'El extintor fue modificado por otra operación. Recarga e intenta de nuevo.',
        );
      }
      return this.get(id);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.extinguisher.updateMany({
        where: { id, rowVersion: dto.rowVersion },
        data: { ...data, rowVersion: { increment: 1 } },
      });

      if (result.count === 0) {
        const current = await tx.extinguisher.findUnique({
          where: { id },
          select: { rowVersion: true },
        });
        if (current === null) {
          throw assetNotFound();
        }
        throw new ApiError(
          409,
          ErrorCodes.CONCURRENCY_CONFLICT,
          'El extintor fue modificado por otra operación. Recarga e intenta de nuevo.',
        );
      }

      await this.upsertEquipmentDueDate(tx, id, dates, type.usefulLifeYears);

      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'EXTINGUISHER_UPDATED',
          entityType: 'EXTINGUISHER',
          entityId: id,
          beforeData: {
            serialNumber: existing.serialNumber,
            brand: existing.brand,
            model: existing.model,
            capacityValue: existing.capacityValue.toFixed(2),
            capacityUnit: existing.capacityUnit,
            manufactureDate: this.dateText(existing.manufactureDate),
            acquiredAt: this.dateText(existing.acquiredAt),
            commissionedAt: this.dateText(existing.commissionedAt),
            manufacturerExpiryDate: this.dateText(
              existing.manufacturerExpiryDate,
            ),
            notes: existing.notes,
            typeId: existing.typeId,
          },
          afterData: {
            serialNumber:
              dto.serialNumber === undefined
                ? existing.serialNumber
                : normalizeOptionalText(dto.serialNumber),
            brand:
              dto.brand === undefined
                ? existing.brand
                : normalizeOptionalText(dto.brand),
            model:
              dto.model === undefined
                ? existing.model
                : normalizeOptionalText(dto.model),
            capacityValue:
              dto.capacityValue === undefined
                ? existing.capacityValue.toFixed(2)
                : dto.capacityValue.toFixed(2),
            capacityUnit: dto.capacityUnit ?? existing.capacityUnit,
            manufactureDate: this.dateText(dates.manufactureDate),
            acquiredAt: this.dateText(dates.acquiredAt),
            commissionedAt: this.dateText(dates.commissionedAt),
            manufacturerExpiryDate: this.dateText(dates.manufacturerExpiryDate),
            notes:
              dto.notes === undefined
                ? existing.notes
                : normalizeOptionalText(dto.notes),
            typeId,
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );

      return tx.extinguisher.findUniqueOrThrow({
        where: { id },
        select: EXTINGUISHER_DETAIL_SELECT,
      });
    });

    return toExtinguisherDetail(updated);
  }

  async changeCondition(
    id: string,
    dto: ChangeConditionDto,
    actor: AuthenticatedUser,
    context: RequestContext,
  ) {
    if (!actor.roles.includes('ADMIN') && !actor.roles.includes('SEGURIDAD')) {
      throw ApiError.forbidden(
        'Solo SEGURIDAD o ADMIN pueden cambiar la condición técnica.',
      );
    }

    const existing = await this.prisma.extinguisher.findUnique({
      where: { id },
      select: {
        id: true,
        assetCode: true,
        logisticsStatus: true,
        technicalCondition: true,
        rowVersion: true,
      },
    });
    if (existing === null) {
      throw assetNotFound();
    }

    if (
      existing.logisticsStatus === 'ASIGNADO' &&
      dto.condition === 'NO_OPERATIVO'
    ) {
      throw ApiError.unprocessable(
        ErrorCodes.CONDITION_NOT_ASSIGNABLE,
        'Un extintor asignado a un área no puede marcarse como NO_OPERATIVO. Trasládalo a un almacén primero.',
      );
    }

    const where: Prisma.ExtinguisherWhereInput = { id };
    if (dto.rowVersion !== undefined) {
      where.rowVersion = dto.rowVersion;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.extinguisher.updateMany({
        where,
        data: {
          technicalCondition: dto.condition,
          rowVersion: { increment: 1 },
        },
      });

      if (result.count === 0) {
        const current = await tx.extinguisher.findUnique({
          where: { id },
          select: { rowVersion: true },
        });
        if (current === null) {
          throw assetNotFound();
        }
        throw new ApiError(
          409,
          ErrorCodes.CONCURRENCY_CONFLICT,
          'El extintor fue modificado por otra operación. Recarga e intenta de nuevo.',
        );
      }

      await this.audit.record(
        {
          actorUserId: actor.id,
          actorLabel: actor.fullName,
          action: 'EXTINGUISHER_CONDITION_CHANGED',
          entityType: 'EXTINGUISHER',
          entityId: id,
          beforeData: {
            technicalCondition: existing.technicalCondition,
          },
          afterData: {
            technicalCondition: dto.condition,
            reason: dto.reason,
            documentRef: normalizeOptionalText(dto.documentRef),
          },
          ip: context.ip ?? null,
          userAgent: context.userAgent ?? null,
          requestId: context.requestId ?? null,
        },
        tx,
      );

      return tx.extinguisher.findUniqueOrThrow({
        where: { id },
        select: EXTINGUISHER_DETAIL_SELECT,
      });
    });

    return toExtinguisherDetail(updated);
  }

  async getAssetCode(id: string): Promise<string> {
    const row = await this.prisma.extinguisher.findUnique({
      where: { id },
      select: { assetCode: true },
    });
    if (row === null) {
      throw assetNotFound();
    }
    return row.assetCode;
  }

  async renderQr(
    id: string,
    format: 'png' | 'svg',
    size: number,
  ): Promise<{ contentType: string; body: Buffer | string }> {
    const assetCode = await this.getAssetCode(id);
    if (format === 'svg') {
      return {
        contentType: 'image/svg+xml',
        body: await this.qrService.renderSvg(assetCode, size),
      };
    }
    return {
      contentType: 'image/png',
      body: await this.qrService.renderPng(assetCode, size),
    };
  }

  async renderLabel(id: string): Promise<string> {
    const assetCode = await this.getAssetCode(id);
    return this.qrService.renderLabel(assetCode);
  }

  private async createInTransaction(
    tx: Tx,
    dto: CreateExtinguisherDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    requestHash: string,
    now: Date,
    expiresAt: Date,
    context: RequestContext,
  ): Promise<{ replayed: boolean; extinguisherId: string }> {
    const record = await tx.idempotencyRecord.findUnique({
      where: {
        userId_idempotencyKey: { userId: actor.id, idempotencyKey },
      },
    });

    if (record !== null && record.expiresAt.getTime() > now.getTime()) {
      if (record.requestHash !== requestHash) {
        throw new ApiError(
          409,
          ErrorCodes.IDEMPOTENCY_CONFLICT,
          'La clave de idempotencia ya se usó con datos distintos.',
        );
      }
      if (record.status === 'PROCESSING') {
        throw new ApiError(
          409,
          ErrorCodes.CONCURRENCY_CONFLICT,
          'La operación con esta clave está en curso. Espera antes de reintentar.',
        );
      }
      if (
        record.resourceType === 'EXTINGUISHER' &&
        record.resourceId !== null
      ) {
        return { replayed: true, extinguisherId: record.resourceId };
      }
      throw new ApiError(
        409,
        ErrorCodes.IDEMPOTENCY_CONFLICT,
        'La clave de idempotencia no corresponde a un alta de extintor.',
      );
    }

    if (record !== null) {
      await tx.idempotencyRecord.delete({ where: { id: record.id } });
    }

    await tx.idempotencyRecord.create({
      data: {
        id: randomUUID(),
        userId: actor.id,
        idempotencyKey,
        method: 'POST',
        path: '/api/v1/extinguishers',
        requestHash,
        status: 'PROCESSING',
        expiresAt,
      },
    });

    const type = await tx.extinguisherType.findUnique({
      where: { id: dto.typeId },
      select: { active: true, usefulLifeYears: true },
    });
    if (type === null || !type.active) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El tipo de extintor no existe o está inactivo.',
        { field: 'typeId' },
      );
    }

    const location = await tx.location.findUnique({
      where: { id: dto.initialLocationId },
      select: { id: true, code: true, name: true, type: true, active: true },
    });
    if (
      location === null ||
      !location.active ||
      (location.type !== 'ALMACEN' && location.type !== 'AREA')
    ) {
      throw ApiError.unprocessable(
        ErrorCodes.DESTINATION_INVALID,
        'La ubicación inicial debe ser un almacén o un área activos.',
        { field: 'initialLocationId' },
      );
    }

    if (location.type === 'AREA' && dto.technicalCondition === 'NO_OPERATIVO') {
      throw ApiError.unprocessable(
        ErrorCodes.CONDITION_NOT_ASSIGNABLE,
        'Un extintor NO_OPERATIVO no puede darse de alta directamente en un área.',
        { field: 'technicalCondition' },
      );
    }

    const dates: CalendarDates = {
      manufactureDate: this.parseDate(dto.manufactureDate, 'manufactureDate'),
      acquiredAt: this.parseDate(dto.acquiredAt, 'acquiredAt'),
      commissionedAt: this.parseDate(dto.commissionedAt, 'commissionedAt'),
      manufacturerExpiryDate: this.parseDate(
        dto.manufacturerExpiryDate,
        'manufacturerExpiryDate',
      ),
    };
    this.assertDates(dates);

    const assetCode = await this.codeCounter.nextCode(EXTINGUISHER_COUNTER, tx);
    const extinguisherId = randomUUID();
    const logisticsStatus: LogisticsStatus =
      location.type === 'ALMACEN' ? 'EN_ALMACEN' : 'ASIGNADO';

    await tx.extinguisher.create({
      data: {
        id: extinguisherId,
        assetCode,
        serialNumber: normalizeOptionalText(dto.serialNumber),
        typeId: dto.typeId,
        brand: normalizeOptionalText(dto.brand),
        model: normalizeOptionalText(dto.model),
        capacityValue: dto.capacityValue.toFixed(2),
        capacityUnit: dto.capacityUnit,
        manufactureDate: dates.manufactureDate,
        acquiredAt: dates.acquiredAt,
        commissionedAt: dates.commissionedAt,
        manufacturerExpiryDate: dates.manufacturerExpiryDate,
        logisticsStatus,
        technicalCondition: dto.technicalCondition,
        placementType: 'INTERNAL',
        currentLocationId: location.id,
        currentSince: now,
        notes: normalizeOptionalText(dto.notes),
        createdById: actor.id,
      },
    });

    const movementId = randomUUID();
    await tx.movement.create({
      data: {
        id: movementId,
        extinguisherId,
        assetSequence: 1,
        movementType: 'INGRESO',
        entrySource: dto.entrySource,
        originKind: 'NONE',
        originLabel: 'Alta inicial',
        destinationKind: 'LOCATION',
        destinationLocationId: location.id,
        destinationLabel: `${location.code} - ${location.name}`,
        movedAt: now,
        receivedBy: dto.receivedBy,
        reason: dto.initialReason,
        documentRef: dto.documentRef,
        createdById: actor.id,
      },
    });

    const equipmentExpiry = earliestEquipmentExpiry(
      dates.manufactureDate,
      dates.manufacturerExpiryDate,
      type.usefulLifeYears,
    );
    if (equipmentExpiry !== null) {
      await tx.dueDate.create({
        data: {
          id: randomUUID(),
          extinguisherId,
          eventType: 'EQUIPO',
          dueDate: equipmentExpiry,
          sourceType: 'EXTINGUISHER',
          sourceId: extinguisherId,
        },
      });
    }

    await this.audit.record(
      {
        actorUserId: actor.id,
        actorLabel: actor.fullName,
        action: 'EXTINGUISHER_CREATED',
        entityType: 'EXTINGUISHER',
        entityId: extinguisherId,
        afterData: {
          assetCode,
          typeId: dto.typeId,
          initialLocationId: location.id,
          logisticsStatus,
          technicalCondition: dto.technicalCondition,
          entrySource: dto.entrySource,
          movementId,
        },
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
        requestId: context.requestId ?? null,
      },
      tx,
    );

    await tx.idempotencyRecord.update({
      where: {
        userId_idempotencyKey: { userId: actor.id, idempotencyKey },
      },
      data: {
        status: 'COMPLETED',
        responseStatus: 201,
        resourceType: 'EXTINGUISHER',
        resourceId: extinguisherId,
      },
    });

    return { replayed: false, extinguisherId };
  }

  private async buildAltaBody(extinguisherId: string): Promise<AltaResponse> {
    const row = await this.prisma.extinguisher.findUniqueOrThrow({
      where: { id: extinguisherId },
      select: EXTINGUISHER_DETAIL_SELECT,
    });
    const movement = await this.prisma.movement.findFirstOrThrow({
      where: { extinguisherId, assetSequence: 1 },
      select: {
        id: true,
        movementType: true,
        assetSequence: true,
        movedAt: true,
      },
    });

    return {
      id: row.id,
      assetCode: row.assetCode,
      qrPayload: this.qrService.payload(row.assetCode),
      extinguisher: toExtinguisherDetail(row),
      movement: {
        id: movement.id,
        type: movement.movementType,
        assetSequence: movement.assetSequence,
        movedAt: movement.movedAt.toISOString(),
      },
    };
  }

  private async upsertEquipmentDueDate(
    tx: Tx,
    extinguisherId: string,
    dates: CalendarDates,
    usefulLifeYears: number | null,
  ): Promise<void> {
    const dueDate = earliestEquipmentExpiry(
      dates.manufactureDate,
      dates.manufacturerExpiryDate,
      usefulLifeYears,
    );

    if (dueDate === null) {
      await tx.dueDate.deleteMany({
        where: { extinguisherId, eventType: 'EQUIPO' },
      });
      return;
    }

    await tx.dueDate.upsert({
      where: {
        extinguisherId_eventType: {
          extinguisherId,
          eventType: 'EQUIPO',
        },
      },
      create: {
        id: randomUUID(),
        extinguisherId,
        eventType: 'EQUIPO',
        dueDate,
        sourceType: 'EXTINGUISHER',
        sourceId: extinguisherId,
      },
      update: {
        dueDate,
        sourceType: 'EXTINGUISHER',
        sourceId: extinguisherId,
        sourceEventAt: null,
      },
    });
  }

  private resolveDates(
    dto: UpdateExtinguisherDto,
    existing: {
      manufactureDate: Date | null;
      acquiredAt: Date | null;
      commissionedAt: Date | null;
      manufacturerExpiryDate: Date | null;
    },
  ): CalendarDates {
    return {
      manufactureDate:
        dto.manufactureDate === undefined
          ? existing.manufactureDate
          : this.parseDate(dto.manufactureDate, 'manufactureDate'),
      acquiredAt:
        dto.acquiredAt === undefined
          ? existing.acquiredAt
          : this.parseDate(dto.acquiredAt, 'acquiredAt'),
      commissionedAt:
        dto.commissionedAt === undefined
          ? existing.commissionedAt
          : this.parseDate(dto.commissionedAt, 'commissionedAt'),
      manufacturerExpiryDate:
        dto.manufacturerExpiryDate === undefined
          ? existing.manufacturerExpiryDate
          : this.parseDate(
              dto.manufacturerExpiryDate,
              'manufacturerExpiryDate',
            ),
    };
  }

  private parseDate(
    value: string | null | undefined,
    field: string,
  ): Date | null {
    if (value === undefined || value === null) {
      return null;
    }
    const parsed = parseCalendarDate(value);
    if (parsed === null) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        `La fecha ${field} no es válida.`,
        { field },
      );
    }
    return parsed;
  }

  private assertDates(dates: CalendarDates): void {
    const error = validateCalendarDates(
      dates,
      todayInTimeZone(this.env.timezone),
    );
    if (error !== null) {
      throw ApiError.unprocessable(error.code, error.message, {
        field: error.field,
      });
    }
  }

  private dateText(date: Date | null): string | null {
    return date === null ? null : date.toISOString().slice(0, 10);
  }

  private async buildWhere(
    query: ListExtinguishersQueryDto,
  ): Promise<Prisma.ExtinguisherWhereInput> {
    const and: Prisma.ExtinguisherWhereInput[] = [];

    if (query.q !== undefined && query.q.length > 0) {
      and.push({
        OR: [
          { assetCode: { contains: query.q } },
          { serialNumber: { contains: query.q } },
          { brand: { contains: query.q } },
          { model: { contains: query.q } },
        ],
      });
    }
    if (query.assetCode !== undefined) {
      and.push({ assetCode: { contains: query.assetCode.toUpperCase() } });
    }
    if (query.serialNumber !== undefined) {
      and.push({ serialNumber: { contains: query.serialNumber } });
    }
    if (query.typeId !== undefined) {
      and.push({ typeId: query.typeId });
    }
    if (query.locationId !== undefined) {
      const locationIds = [query.locationId];
      if (query.includeDescendants === true) {
        const children = await this.prisma.location.findMany({
          where: { parentId: query.locationId },
          select: { id: true },
        });
        locationIds.push(...children.map((child) => child.id));
      }
      and.push({ currentLocationId: { in: locationIds } });
    }
    if (query.logisticsStatus !== undefined) {
      and.push({ logisticsStatus: query.logisticsStatus });
    }
    if (
      query.includeRetired !== true &&
      query.logisticsStatus !== 'DADO_DE_BAJA'
    ) {
      and.push({ logisticsStatus: { not: 'DADO_DE_BAJA' } });
    }
    if (query.technicalCondition !== undefined) {
      and.push({ technicalCondition: query.technicalCondition });
    }

    return and.length === 0 ? {} : { AND: and };
  }

  private buildOrderBy(
    sort: string | undefined,
  ): Prisma.ExtinguisherOrderByWithRelationInput {
    const value = sort ?? 'assetCode';
    if (value.startsWith('-')) {
      return { [value.slice(1)]: 'desc' };
    }
    return { [value]: 'asc' };
  }
}
