import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashPayload } from '../../common/idempotency/request-hash';
import { APP_ENV } from '../../config/config.module';
import type { AppEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import { applyDueDateProjection } from '../due-dates/due-date-projection';
import {
  EXTINGUISHER_DETAIL_SELECT,
  toExtinguisherDetail,
} from '../extinguishers/extinguisher-view';
import {
  Tx,
  lockAsset,
  normalizeOptionalText,
} from '../movements/movement-core';
import { assertNotRetired } from '../maintenance/maintenance-policy';
import {
  calendarDateOf,
  parseEventInstant,
  parseOptionalCalendarDate,
  validateEventInstant,
  validateNextDueDate,
} from '../../common/time/event-dates';
import {
  CreateInspectionDto,
  ListInspectionsQueryDto,
} from './dto/inspection.dto';
import { normalizeChecklist } from './inspection-policy';
import { INSPECTION_SELECT, toInspectionView } from './inspection-view';

export interface InspectionOperationBody {
  inspection: ReturnType<typeof toInspectionView>;
  extinguisher: ReturnType<typeof toExtinguisherDetail>;
}

export interface InspectionOperationResult {
  replayed: boolean;
  body: InspectionOperationBody;
}

function inspectionNotFound(): ApiError {
  return new ApiError(
    404,
    ErrorCodes.INSPECTION_NOT_FOUND,
    'La inspección no existe.',
  );
}

function hashInspection(
  extinguisherId: string,
  dto: CreateInspectionDto,
): string {
  return hashPayload({
    action: 'INSPECTION_CREATE',
    extinguisherId,
    inspectedAt: dto.inspectedAt,
    inspectorName: dto.inspectorName,
    inspectorUserId: dto.inspectorUserId ?? null,
    result: dto.result,
    checklist: dto.checklist ?? null,
    nextDueDate: dto.nextDueDate ?? null,
    notes: dto.notes ?? null,
    documentRef: dto.documentRef ?? null,
  });
}

@Injectable()
export class InspectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
    @Inject(APP_ENV) private readonly env: AppEnv,
  ) {}

  async create(
    extinguisherId: string,
    dto: CreateInspectionDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<InspectionOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashInspection(extinguisherId, dto),
        path: `/api/v1/extinguishers/${extinguisherId}/inspections`,
        resourceType: 'INSPECTION',
      },
      async (tx) => {
        const asset = await lockAsset(tx, extinguisherId);
        assertNotRetired(asset);

        const inspectedAt = parseEventInstant(dto.inspectedAt, 'inspectedAt');
        validateEventInstant(inspectedAt, {
          assetCreatedAt: asset.createdAt,
          field: 'inspectedAt',
        });
        const inspectedOn = calendarDateOf(inspectedAt, this.env.timezone);
        const nextDueDate = parseOptionalCalendarDate(
          dto.nextDueDate,
          'nextDueDate',
        );
        validateNextDueDate(nextDueDate, inspectedOn);

        if (dto.inspectorUserId !== undefined) {
          await this.assertActiveUser(tx, dto.inspectorUserId);
        }
        const checklist = normalizeChecklist(dto.checklist);

        const inspectionId = randomUUID();
        await tx.inspection.create({
          data: {
            id: inspectionId,
            extinguisherId,
            inspectedAt,
            inspectedOn,
            inspectorUserId: dto.inspectorUserId ?? null,
            inspectorName: dto.inspectorName.trim(),
            result: dto.result,
            checklistJson:
              checklist === null
                ? Prisma.JsonNull
                : (checklist as Prisma.InputJsonValue),
            nextDueDate,
            notes: normalizeOptionalText(dto.notes),
            documentRef: normalizeOptionalText(dto.documentRef),
            createdById: actor.id,
          },
        });

        await applyDueDateProjection(tx, {
          extinguisherId,
          eventType: 'INSPECCION',
          dueDate: nextDueDate,
          sourceType: 'INSPECTION',
          sourceId: inspectionId,
          sourceEventAt: inspectedAt,
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'INSPECTION_CREATED',
            entityType: 'INSPECTION',
            entityId: inspectionId,
            afterData: {
              extinguisherId,
              assetCode: asset.assetCode,
              inspectedAt: inspectedAt.toISOString(),
              inspectedOn: inspectedOn.toISOString().slice(0, 10),
              result: dto.result,
              nextDueDate:
                nextDueDate === null
                  ? null
                  : nextDueDate.toISOString().slice(0, 10),
              // D-28: la inspección no cambia la condición técnica.
              technicalCondition: asset.technicalCondition,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: inspectionId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      body: await this.buildBody(outcome.resourceId),
    };
  }

  async list(query: ListInspectionsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.inspection.findMany({
        where,
        select: INSPECTION_SELECT,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inspection.count({ where }),
    ]);

    return {
      data: rows.map((row) => toInspectionView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async get(id: string) {
    const row = await this.prisma.inspection.findUnique({
      where: { id },
      select: INSPECTION_SELECT,
    });
    if (row === null) {
      throw inspectionNotFound();
    }
    return toInspectionView(row);
  }

  private buildWhere(
    query: ListInspectionsQueryDto,
  ): Prisma.InspectionWhereInput {
    const and: Prisma.InspectionWhereInput[] = [];

    if (query.extinguisherId !== undefined) {
      and.push({ extinguisherId: query.extinguisherId });
    }
    if (query.assetCode !== undefined) {
      and.push({
        extinguisher: {
          assetCode: { contains: query.assetCode.toUpperCase() },
        },
      });
    }
    if (query.result !== undefined) {
      and.push({ result: query.result });
    }
    if (query.inspectedFrom !== undefined || query.inspectedTo !== undefined) {
      and.push({
        inspectedOn: {
          ...(query.inspectedFrom === undefined
            ? {}
            : { gte: new Date(`${query.inspectedFrom}T00:00:00.000Z`) }),
          ...(query.inspectedTo === undefined
            ? {}
            : { lte: new Date(`${query.inspectedTo}T00:00:00.000Z`) }),
        },
      });
    }

    return and.length === 0 ? {} : { AND: and };
  }

  private buildOrderBy(
    sort: string | undefined,
  ): Prisma.InspectionOrderByWithRelationInput {
    const value = sort ?? '-inspectedAt';
    if (value.startsWith('-')) {
      return { [value.slice(1)]: 'desc' };
    }
    return { [value]: 'asc' };
  }

  private async assertActiveUser(tx: Tx, userId: string): Promise<void> {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { active: true },
    });
    if (user === null || !user.active) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El inspector indicado no existe o está inactivo.',
        { field: 'inspectorUserId' },
      );
    }
  }

  private async buildBody(
    inspectionId: string,
  ): Promise<InspectionOperationBody> {
    const inspection = await this.prisma.inspection.findUnique({
      where: { id: inspectionId },
      select: INSPECTION_SELECT,
    });
    if (inspection === null) {
      throw inspectionNotFound();
    }
    const extinguisher = await this.prisma.extinguisher.findUniqueOrThrow({
      where: { id: inspection.extinguisherId },
      select: EXTINGUISHER_DETAIL_SELECT,
    });

    return {
      inspection: toInspectionView(inspection),
      extinguisher: toExtinguisherDetail(extinguisher),
    };
  }
}
