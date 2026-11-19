import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { hashPayload } from '../../common/idempotency/request-hash';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import {
  AdjustMovementDto,
  CreateMovementDto,
  ListMovementsQueryDto,
  RetireExtinguisherDto,
} from './dto/movements.dto';
import {
  MovementOperationResult,
  Tx,
  assetNotFound,
  assertRowVersion,
  buildMovementBody,
  locationLabel,
  lockAsset,
  nextSequence,
  normalizeOptionalText,
  requireText,
  resolveActiveLocation,
  snapshotOrigin,
  toPolicyState,
} from './movement-core';
import {
  PlacementTarget,
  parseMovedAt,
  validateAdjustment,
  validateMovedAt,
  validateOperationalMovement,
  validateRetirement,
} from './movement-policy';
import { MOVEMENT_SELECT, toMovementView } from './movement-view';

function hashMovement(extinguisherId: string, dto: CreateMovementDto): string {
  return hashPayload({
    action: 'MOVEMENT',
    extinguisherId,
    type: dto.type,
    originLocationId: dto.originLocationId,
    destinationLocationId: dto.destinationLocationId,
    movedAt: dto.movedAt,
    requestedBy: dto.requestedBy ?? null,
    authorizedBy: dto.authorizedBy ?? null,
    deliveredBy: dto.deliveredBy ?? null,
    receivedBy: dto.receivedBy ?? null,
    reason: dto.reason,
    documentRef: dto.documentRef ?? null,
    notes: dto.notes ?? null,
    rowVersion: dto.rowVersion,
  });
}

function hashRetirement(
  extinguisherId: string,
  dto: RetireExtinguisherDto,
): string {
  return hashPayload({
    action: 'RETIRE',
    extinguisherId,
    movedAt: dto.movedAt,
    authorizedBy: dto.authorizedBy,
    reason: dto.reason,
    documentRef: dto.documentRef,
    notes: dto.notes ?? null,
    rowVersion: dto.rowVersion,
  });
}

function hashAdjustment(
  extinguisherId: string,
  dto: AdjustMovementDto,
): string {
  return hashPayload({
    action: 'ADJUST',
    extinguisherId,
    placementType: dto.placementType,
    locationId: dto.locationId ?? null,
    externalPartyId: dto.externalPartyId ?? null,
    movedAt: dto.movedAt,
    authorizedBy: dto.authorizedBy,
    reason: dto.reason,
    documentRef: dto.documentRef,
    correctsMovementId: dto.correctsMovementId ?? null,
    notes: dto.notes ?? null,
    rowVersion: dto.rowVersion,
  });
}

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly idempotency: IdempotencyService,
  ) {}

  async createMovement(
    extinguisherId: string,
    dto: CreateMovementDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MovementOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashMovement(extinguisherId, dto),
        path: `/api/v1/extinguishers/${extinguisherId}/movements`,
        resourceType: 'MOVEMENT',
      },
      async (tx) => {
        const asset = await lockAsset(tx, extinguisherId);
        assertRowVersion(asset, dto.rowVersion);

        const movedAt = parseMovedAt(dto.movedAt);
        validateMovedAt(movedAt, toPolicyState(asset));

        const destination = await resolveActiveLocation(
          tx,
          dto.destinationLocationId,
        );
        const { logisticsStatus } = validateOperationalMovement({
          type: dto.type,
          originLocationId: dto.originLocationId,
          destinationLocationId: destination.id,
          destinationLocationType: destination.type,
          asset: toPolicyState(asset),
        });
        const evidence = this.resolveOperationalEvidence(dto);
        const origin = snapshotOrigin(asset);
        const assetSequence = nextSequence(asset);
        const movementId = randomUUID();

        await tx.movement.create({
          data: {
            id: movementId,
            extinguisherId,
            assetSequence,
            movementType: dto.type,
            originKind: origin.kind,
            originLocationId: origin.locationId,
            originExternalPartyId: origin.externalPartyId,
            originLabel: origin.label,
            destinationKind: 'LOCATION',
            destinationLocationId: destination.id,
            destinationLabel: locationLabel(destination),
            movedAt,
            requestedBy: evidence.requestedBy,
            authorizedBy: evidence.authorizedBy,
            deliveredBy: evidence.deliveredBy,
            receivedBy: evidence.receivedBy,
            reason: dto.reason,
            documentRef: normalizeOptionalText(dto.documentRef),
            notes: normalizeOptionalText(dto.notes),
            createdById: actor.id,
          },
        });

        await tx.extinguisher.update({
          where: { id: extinguisherId },
          data: {
            logisticsStatus,
            placementType: 'INTERNAL',
            currentLocationId: destination.id,
            currentExternalPartyId: null,
            currentSince: movedAt,
            rowVersion: { increment: 1 },
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'MOVEMENT_CREATED',
            entityType: 'MOVEMENT',
            entityId: movementId,
            afterData: {
              extinguisherId,
              assetCode: asset.assetCode,
              type: dto.type,
              assetSequence,
              origin: origin.label,
              destination: locationLabel(destination),
              movedAt: movedAt.toISOString(),
              logisticsStatus,
              rowVersionBefore: asset.rowVersion,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: movementId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      body: await buildMovementBody(this.prisma, outcome.resourceId),
    };
  }

  async retire(
    extinguisherId: string,
    dto: RetireExtinguisherDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MovementOperationResult> {
    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashRetirement(extinguisherId, dto),
        path: `/api/v1/extinguishers/${extinguisherId}/retire`,
        resourceType: 'MOVEMENT',
      },
      async (tx) => {
        const asset = await lockAsset(tx, extinguisherId);
        assertRowVersion(asset, dto.rowVersion);

        const movedAt = parseMovedAt(dto.movedAt);
        validateMovedAt(movedAt, toPolicyState(asset));
        validateRetirement(toPolicyState(asset));

        const origin = snapshotOrigin(asset);
        const assetSequence = nextSequence(asset);
        const movementId = randomUUID();

        await tx.movement.create({
          data: {
            id: movementId,
            extinguisherId,
            assetSequence,
            movementType: 'BAJA',
            originKind: origin.kind,
            originLocationId: origin.locationId,
            originExternalPartyId: origin.externalPartyId,
            originLabel: origin.label,
            destinationKind: 'NONE',
            destinationLabel: 'Baja del activo',
            movedAt,
            authorizedBy: dto.authorizedBy,
            reason: dto.reason,
            documentRef: dto.documentRef,
            notes: normalizeOptionalText(dto.notes),
            createdById: actor.id,
          },
        });

        await tx.extinguisher.update({
          where: { id: extinguisherId },
          data: {
            logisticsStatus: 'DADO_DE_BAJA',
            placementType: 'NONE',
            currentLocationId: null,
            currentExternalPartyId: null,
            currentSince: movedAt,
            retiredAt: movedAt,
            retirementReason: dto.reason,
            rowVersion: { increment: 1 },
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'EXTINGUISHER_RETIRED',
            entityType: 'EXTINGUISHER',
            entityId: extinguisherId,
            beforeData: {
              logisticsStatus: asset.logisticsStatus,
              placement: origin.label,
              retiredAt: asset.retiredAt?.toISOString() ?? null,
            },
            afterData: {
              assetCode: asset.assetCode,
              movementId,
              assetSequence,
              movedAt: movedAt.toISOString(),
              authorizedBy: dto.authorizedBy,
              documentRef: dto.documentRef,
              reason: dto.reason,
              rowVersionBefore: asset.rowVersion,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: movementId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      body: await buildMovementBody(this.prisma, outcome.resourceId),
    };
  }

  async adjust(
    extinguisherId: string,
    dto: AdjustMovementDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MovementOperationResult> {
    if (!actor.roles.includes('ADMIN')) {
      throw ApiError.forbidden('Solo ADMIN puede registrar ajustes.');
    }

    const outcome = await this.idempotency.run(
      {
        actorId: actor.id,
        key: idempotencyKey,
        requestHash: hashAdjustment(extinguisherId, dto),
        path: `/api/v1/extinguishers/${extinguisherId}/adjustments`,
        resourceType: 'MOVEMENT',
      },
      async (tx) => {
        const asset = await lockAsset(tx, extinguisherId);
        assertRowVersion(asset, dto.rowVersion);

        const movedAt = parseMovedAt(dto.movedAt);
        validateMovedAt(movedAt, toPolicyState(asset));

        const { target, label } = await this.resolveAdjustmentTarget(tx, dto);
        const correctsMovement = await this.resolveCorrectsMovement(
          tx,
          extinguisherId,
          dto.correctsMovementId,
        );
        const result = validateAdjustment({
          asset: toPolicyState(asset),
          target,
          correctsMovement,
        });

        const origin = snapshotOrigin(asset);
        const assetSequence = nextSequence(asset);
        const movementId = randomUUID();

        await tx.movement.create({
          data: {
            id: movementId,
            extinguisherId,
            assetSequence,
            movementType: 'AJUSTE',
            originKind: origin.kind,
            originLocationId: origin.locationId,
            originExternalPartyId: origin.externalPartyId,
            originLabel: origin.label,
            destinationKind:
              target.kind === 'INTERNAL' ? 'LOCATION' : 'EXTERNAL_PARTY',
            destinationLocationId:
              target.kind === 'INTERNAL' ? target.locationId : null,
            destinationExternalPartyId:
              target.kind === 'EXTERNAL' ? target.externalPartyId : null,
            destinationLabel: label,
            movedAt,
            authorizedBy: dto.authorizedBy,
            reason: dto.reason,
            documentRef: dto.documentRef,
            notes: normalizeOptionalText(dto.notes),
            correctsMovementId: dto.correctsMovementId ?? null,
            createdById: actor.id,
          },
        });

        await tx.extinguisher.update({
          where: { id: extinguisherId },
          data: {
            logisticsStatus: result.logisticsStatus,
            placementType: target.kind,
            currentLocationId:
              target.kind === 'INTERNAL' ? target.locationId : null,
            currentExternalPartyId:
              target.kind === 'EXTERNAL' ? target.externalPartyId : null,
            currentSince: movedAt,
            retiredAt: null,
            retirementReason: null,
            rowVersion: { increment: 1 },
          },
        });

        await this.audit.record(
          {
            actorUserId: actor.id,
            actorLabel: actor.fullName,
            action: 'MOVEMENT_ADJUSTED',
            entityType: 'MOVEMENT',
            entityId: movementId,
            beforeData: {
              logisticsStatus: asset.logisticsStatus,
              placement: origin.label,
              retiredAt: asset.retiredAt?.toISOString() ?? null,
            },
            afterData: {
              extinguisherId,
              assetCode: asset.assetCode,
              assetSequence,
              placement: label,
              logisticsStatus: result.logisticsStatus,
              reactivates: result.reactivates,
              correctsMovementId: dto.correctsMovementId ?? null,
              authorizedBy: dto.authorizedBy,
              documentRef: dto.documentRef,
              reason: dto.reason,
              rowVersionBefore: asset.rowVersion,
            },
            ip: context.ip ?? null,
            userAgent: context.userAgent ?? null,
            requestId: context.requestId ?? null,
          },
          tx,
        );

        return { resourceId: movementId, responseStatus: 201 };
      },
    );

    return {
      replayed: outcome.replayed,
      body: await buildMovementBody(this.prisma, outcome.resourceId),
    };
  }

  async list(query: ListMovementsQueryDto) {
    return this.listMovements(query);
  }

  async listByExtinguisher(
    extinguisherId: string,
    query: ListMovementsQueryDto,
  ) {
    const asset = await this.prisma.extinguisher.findUnique({
      where: { id: extinguisherId },
      select: { id: true },
    });
    if (asset === null) {
      throw assetNotFound();
    }
    return this.listMovements(query, extinguisherId);
  }

  async get(id: string) {
    const row = await this.prisma.movement.findUnique({
      where: { id },
      select: MOVEMENT_SELECT,
    });
    if (row === null) {
      throw ApiError.notFound('El movimiento no existe.');
    }
    return toMovementView(row);
  }

  private async listMovements(
    query: ListMovementsQueryDto,
    forcedExtinguisherId?: string,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(query, forcedExtinguisherId);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.movement.findMany({
        where,
        select: MOVEMENT_SELECT,
        orderBy: this.buildOrderBy(query.sort),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.movement.count({ where }),
    ]);

    return {
      data: rows.map((row) => toMovementView(row)),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  private buildWhere(
    query: ListMovementsQueryDto,
    forcedExtinguisherId?: string,
  ): Prisma.MovementWhereInput {
    const and: Prisma.MovementWhereInput[] = [];
    const extinguisherId = forcedExtinguisherId ?? query.extinguisherId;

    if (extinguisherId !== undefined) {
      and.push({ extinguisherId });
    }
    if (query.assetCode !== undefined) {
      and.push({
        extinguisher: {
          assetCode: { contains: query.assetCode.toUpperCase() },
        },
      });
    }
    if (query.type !== undefined) {
      and.push({ movementType: query.type });
    }
    if (query.locationId !== undefined) {
      and.push({
        OR: [
          { originLocationId: query.locationId },
          { destinationLocationId: query.locationId },
        ],
      });
    }
    if (query.from !== undefined || query.to !== undefined) {
      and.push({
        movedAt: {
          ...(query.from === undefined
            ? {}
            : { gte: new Date(`${query.from}T00:00:00.000Z`) }),
          ...(query.to === undefined
            ? {}
            : { lte: new Date(`${query.to}T23:59:59.999Z`) }),
        },
      });
    }
    if (query.createdById !== undefined) {
      and.push({ createdById: query.createdById });
    }

    return and.length === 0 ? {} : { AND: and };
  }

  private buildOrderBy(
    sort: string | undefined,
  ): Prisma.MovementOrderByWithRelationInput {
    const value = sort ?? '-movedAt';
    if (value.startsWith('-')) {
      return { [value.slice(1)]: 'desc' };
    }
    return { [value]: 'asc' };
  }

  private async resolveAdjustmentTarget(
    tx: Tx,
    dto: AdjustMovementDto,
  ): Promise<{ target: PlacementTarget; label: string }> {
    if (dto.placementType === 'INTERNAL') {
      if (dto.locationId === undefined) {
        throw ApiError.unprocessable(
          ErrorCodes.VALIDATION_ERROR,
          'El ajuste a una ubicación interna exige locationId.',
          { field: 'locationId' },
        );
      }
      if (dto.externalPartyId !== undefined) {
        throw ApiError.unprocessable(
          ErrorCodes.VALIDATION_ERROR,
          'No envíes externalPartyId cuando la colocación es interna.',
          { field: 'externalPartyId' },
        );
      }

      const location = await tx.location.findUnique({
        where: { id: dto.locationId },
        select: { id: true, code: true, name: true, type: true, active: true },
      });
      if (
        location === null ||
        !location.active ||
        (location.type !== 'ALMACEN' &&
          location.type !== 'AREA' &&
          location.type !== 'TALLER')
      ) {
        throw ApiError.unprocessable(
          ErrorCodes.DESTINATION_INVALID,
          'La ubicación del ajuste debe ser un almacén, área o taller activos.',
          { field: 'locationId' },
        );
      }
      return {
        target: {
          kind: 'INTERNAL',
          locationId: location.id,
          locationType: location.type,
        },
        label: locationLabel(location),
      };
    }

    if (dto.externalPartyId === undefined) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El ajuste a una entidad externa exige externalPartyId.',
        { field: 'externalPartyId' },
      );
    }
    if (dto.locationId !== undefined) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'No envíes locationId cuando la colocación es externa.',
        { field: 'locationId' },
      );
    }

    const party = await tx.externalParty.findUnique({
      where: { id: dto.externalPartyId },
      select: { id: true, code: true, name: true, active: true },
    });
    if (party === null || !party.active) {
      throw ApiError.unprocessable(
        ErrorCodes.DESTINATION_INVALID,
        'La entidad externa del ajuste no existe o está inactiva.',
        { field: 'externalPartyId' },
      );
    }
    return {
      target: { kind: 'EXTERNAL', externalPartyId: party.id },
      label: locationLabel(party),
    };
  }

  private async resolveCorrectsMovement(
    tx: Tx,
    extinguisherId: string,
    correctsMovementId: string | undefined,
  ): Promise<{ id: string; movementType: string } | null> {
    if (correctsMovementId === undefined) {
      return null;
    }
    const movement = await tx.movement.findUnique({
      where: { id: correctsMovementId },
      select: { id: true, extinguisherId: true, movementType: true },
    });
    if (movement === null || movement.extinguisherId !== extinguisherId) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El movimiento corregido no existe o no pertenece a este extintor.',
        { field: 'correctsMovementId' },
      );
    }
    return { id: movement.id, movementType: movement.movementType };
  }

  private resolveOperationalEvidence(dto: CreateMovementDto): {
    requestedBy: string | null;
    authorizedBy: string | null;
    deliveredBy: string;
    receivedBy: string;
  } {
    const requestedBy =
      dto.type === 'RETORNO_ALMACEN'
        ? normalizeOptionalText(dto.requestedBy)
        : requireText(dto.requestedBy, 'requestedBy');

    return {
      requestedBy,
      authorizedBy: normalizeOptionalText(dto.authorizedBy),
      deliveredBy: requireText(dto.deliveredBy, 'deliveredBy'),
      receivedBy: requireText(dto.receivedBy, 'receivedBy'),
    };
  }
}
