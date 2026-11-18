import { Injectable } from '@nestjs/common';
import {
  LocationType,
  LogisticsStatus,
  MovementType,
  PlacementType,
  Prisma,
  TechnicalCondition,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/auth/authenticated-user';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { RequestContext } from '../auth/auth.service';
import {
  EXTINGUISHER_DETAIL_SELECT,
  toExtinguisherDetail,
} from '../extinguishers/extinguisher-view';
import {
  AdjustMovementDto,
  CreateMovementDto,
  ListMovementsQueryDto,
  RetireExtinguisherDto,
} from './dto/movements.dto';
import {
  AssetMovementState,
  PlacementTarget,
  parseMovedAt,
  validateAdjustment,
  validateMovedAt,
  validateOperationalMovement,
  validateRetirement,
} from './movement-policy';
import { MOVEMENT_SELECT, toMovementView } from './movement-view';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 3;
const ACTIVE_MAINTENANCE_STATUSES = ['ABIERTA', 'EN_PROVEEDOR'] as const;

type Tx = Prisma.TransactionClient;

interface LockedAsset {
  id: string;
  assetCode: string;
  logisticsStatus: LogisticsStatus;
  technicalCondition: TechnicalCondition;
  placementType: PlacementType;
  currentLocationId: string | null;
  currentExternalPartyId: string | null;
  currentSince: Date | null;
  retiredAt: Date | null;
  rowVersion: number;
  createdAt: Date;
  currentLocation: {
    id: string;
    code: string;
    name: string;
    type: LocationType;
  } | null;
  currentExternalParty: {
    id: string;
    code: string;
    name: string;
  } | null;
  lastMovement: {
    id: string;
    assetSequence: number;
    movedAt: Date;
    movementType: MovementType;
  } | null;
  hasActiveMaintenanceOrder: boolean;
}

interface EndpointSnapshot {
  kind: 'LOCATION' | 'EXTERNAL_PARTY' | 'NONE';
  locationId: string | null;
  externalPartyId: string | null;
  label: string;
}

export interface MovementOperationResult {
  replayed: boolean;
  body: {
    movement: ReturnType<typeof toMovementView>;
    extinguisher: ReturnType<typeof toExtinguisherDetail>;
  };
}

function assetNotFound(): ApiError {
  return new ApiError(
    404,
    ErrorCodes.ASSET_NOT_FOUND,
    'El extintor no existe.',
  );
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

function locationLabel(location: { code: string; name: string }): string {
  return `${location.code} - ${location.name}`;
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

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

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

@Injectable()
export class MovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createMovement(
    extinguisherId: string,
    dto: CreateMovementDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MovementOperationResult> {
    const outcome = await this.runIdempotent(
      actor,
      idempotencyKey,
      hashMovement(extinguisherId, dto),
      `/api/v1/extinguishers/${extinguisherId}/movements`,
      async (tx) => {
        const asset = await this.loadLockedAsset(tx, extinguisherId);
        this.assertRowVersion(asset, dto.rowVersion);

        const movedAt = parseMovedAt(dto.movedAt);
        validateMovedAt(movedAt, this.toPolicyState(asset));

        const destination = await this.resolveDestination(
          tx,
          dto.destinationLocationId,
        );
        const { logisticsStatus } = validateOperationalMovement({
          type: dto.type,
          originLocationId: dto.originLocationId,
          destinationLocationId: destination.id,
          destinationLocationType: destination.type,
          asset: this.toPolicyState(asset),
        });
        const evidence = this.resolveOperationalEvidence(dto);
        const origin = this.snapshotOrigin(asset);
        const assetSequence = this.nextSequence(asset);
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
      body: await this.buildMovementBody(outcome.resourceId),
    };
  }

  async retire(
    extinguisherId: string,
    dto: RetireExtinguisherDto,
    actor: AuthenticatedUser,
    idempotencyKey: string,
    context: RequestContext,
  ): Promise<MovementOperationResult> {
    const outcome = await this.runIdempotent(
      actor,
      idempotencyKey,
      hashRetirement(extinguisherId, dto),
      `/api/v1/extinguishers/${extinguisherId}/retire`,
      async (tx) => {
        const asset = await this.loadLockedAsset(tx, extinguisherId);
        this.assertRowVersion(asset, dto.rowVersion);

        const movedAt = parseMovedAt(dto.movedAt);
        validateMovedAt(movedAt, this.toPolicyState(asset));
        validateRetirement(this.toPolicyState(asset));

        const origin = this.snapshotOrigin(asset);
        const assetSequence = this.nextSequence(asset);
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
      body: await this.buildMovementBody(outcome.resourceId),
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

    const outcome = await this.runIdempotent(
      actor,
      idempotencyKey,
      hashAdjustment(extinguisherId, dto),
      `/api/v1/extinguishers/${extinguisherId}/adjustments`,
      async (tx) => {
        const asset = await this.loadLockedAsset(tx, extinguisherId);
        this.assertRowVersion(asset, dto.rowVersion);

        const movedAt = parseMovedAt(dto.movedAt);
        validateMovedAt(movedAt, this.toPolicyState(asset));

        const { target, label } = await this.resolveAdjustmentTarget(tx, dto);
        const correctsMovement = await this.resolveCorrectsMovement(
          tx,
          extinguisherId,
          dto.correctsMovementId,
        );
        const result = validateAdjustment({
          asset: this.toPolicyState(asset),
          target,
          correctsMovement,
        });

        const origin = this.snapshotOrigin(asset);
        const assetSequence = this.nextSequence(asset);
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
      body: await this.buildMovementBody(outcome.resourceId),
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

  private async loadLockedAsset(
    tx: Tx,
    extinguisherId: string,
  ): Promise<LockedAsset> {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM extinguishers WHERE id = ${extinguisherId} FOR UPDATE
    `;
    if (locked.length === 0) {
      throw assetNotFound();
    }

    const asset = await tx.extinguisher.findUnique({
      where: { id: extinguisherId },
      select: {
        id: true,
        assetCode: true,
        logisticsStatus: true,
        technicalCondition: true,
        placementType: true,
        currentLocationId: true,
        currentExternalPartyId: true,
        currentSince: true,
        retiredAt: true,
        rowVersion: true,
        createdAt: true,
        currentLocation: {
          select: { id: true, code: true, name: true, type: true },
        },
        currentExternalParty: {
          select: { id: true, code: true, name: true },
        },
      },
    });
    if (asset === null) {
      throw assetNotFound();
    }

    const [lastMovement, activeOrder] = await Promise.all([
      tx.movement.findFirst({
        where: { extinguisherId },
        orderBy: { assetSequence: 'desc' },
        select: {
          id: true,
          assetSequence: true,
          movedAt: true,
          movementType: true,
        },
      }),
      tx.maintenanceOrder.findFirst({
        where: {
          extinguisherId,
          status: { in: [...ACTIVE_MAINTENANCE_STATUSES] },
        },
        select: { id: true },
      }),
    ]);

    return {
      ...asset,
      lastMovement,
      hasActiveMaintenanceOrder: activeOrder !== null,
    };
  }

  private toPolicyState(asset: LockedAsset): AssetMovementState {
    return {
      id: asset.id,
      logisticsStatus: asset.logisticsStatus,
      technicalCondition: asset.technicalCondition,
      placementType: asset.placementType,
      currentLocationId: asset.currentLocationId,
      currentLocationType: asset.currentLocation?.type ?? null,
      currentExternalPartyId: asset.currentExternalPartyId,
      createdAt: asset.createdAt,
      lastMovementAt: asset.lastMovement?.movedAt ?? null,
      hasActiveMaintenanceOrder: asset.hasActiveMaintenanceOrder,
    };
  }

  private assertRowVersion(asset: LockedAsset, expected: number): void {
    if (asset.rowVersion !== expected) {
      throw new ApiError(
        409,
        ErrorCodes.CONCURRENCY_CONFLICT,
        'El extintor fue modificado por otra operación. Recarga e intenta de nuevo.',
        { field: 'rowVersion', expected: asset.rowVersion, received: expected },
      );
    }
  }

  private nextSequence(asset: LockedAsset): number {
    return (asset.lastMovement?.assetSequence ?? 0) + 1;
  }

  private snapshotOrigin(asset: LockedAsset): EndpointSnapshot {
    if (asset.placementType === 'INTERNAL' && asset.currentLocation !== null) {
      return {
        kind: 'LOCATION',
        locationId: asset.currentLocation.id,
        externalPartyId: null,
        label: locationLabel(asset.currentLocation),
      };
    }
    if (
      asset.placementType === 'EXTERNAL' &&
      asset.currentExternalParty !== null
    ) {
      return {
        kind: 'EXTERNAL_PARTY',
        locationId: null,
        externalPartyId: asset.currentExternalParty.id,
        label: locationLabel(asset.currentExternalParty),
      };
    }
    return {
      kind: 'NONE',
      locationId: null,
      externalPartyId: null,
      label: 'Sin colocación',
    };
  }

  private async resolveDestination(
    tx: Tx,
    locationId: string,
  ): Promise<{ id: string; code: string; name: string; type: LocationType }> {
    const location = await tx.location.findUnique({
      where: { id: locationId },
      select: { id: true, code: true, name: true, type: true, active: true },
    });
    if (location === null || !location.active) {
      throw ApiError.unprocessable(
        ErrorCodes.DESTINATION_INVALID,
        'La ubicación de destino no existe o está inactiva.',
        { field: 'destinationLocationId' },
      );
    }
    return location;
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
        : this.requireText(dto.requestedBy, 'requestedBy');

    return {
      requestedBy,
      authorizedBy: normalizeOptionalText(dto.authorizedBy),
      deliveredBy: this.requireText(dto.deliveredBy, 'deliveredBy'),
      receivedBy: this.requireText(dto.receivedBy, 'receivedBy'),
    };
  }

  private requireText(value: string | undefined, field: string): string {
    const normalized = value?.trim() ?? '';
    if (normalized.length === 0) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        `El campo ${field} es obligatorio para este movimiento.`,
        { field },
      );
    }
    return normalized;
  }

  private async buildMovementBody(
    movementId: string,
  ): Promise<MovementOperationResult['body']> {
    const movement = await this.prisma.movement.findUniqueOrThrow({
      where: { id: movementId },
      select: MOVEMENT_SELECT,
    });
    const extinguisher = await this.prisma.extinguisher.findUniqueOrThrow({
      where: { id: movement.extinguisherId },
      select: EXTINGUISHER_DETAIL_SELECT,
    });

    return {
      movement: toMovementView(movement),
      extinguisher: toExtinguisherDetail(extinguisher),
    };
  }

  private async runIdempotent(
    actor: AuthenticatedUser,
    idempotencyKey: string,
    requestHash: string,
    path: string,
    create: (tx: Tx) => Promise<{ resourceId: string; responseStatus: number }>,
  ): Promise<{ replayed: boolean; resourceId: string }> {
    const key = idempotencyKey.trim();
    if (key.length === 0 || key.length > 64) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El encabezado Idempotency-Key es obligatorio y admite hasta 64 caracteres.',
        { field: 'Idempotency-Key' },
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const record = await tx.idempotencyRecord.findUnique({
              where: {
                userId_idempotencyKey: {
                  userId: actor.id,
                  idempotencyKey: key,
                },
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
                record.resourceType === 'MOVEMENT' &&
                record.resourceId !== null
              ) {
                return { replayed: true, resourceId: record.resourceId };
              }
              throw new ApiError(
                409,
                ErrorCodes.IDEMPOTENCY_CONFLICT,
                'La clave de idempotencia no corresponde a un movimiento.',
              );
            }

            if (record !== null) {
              await tx.idempotencyRecord.delete({
                where: { id: record.id },
              });
            }

            await tx.idempotencyRecord.create({
              data: {
                id: randomUUID(),
                userId: actor.id,
                idempotencyKey: key,
                method: 'POST',
                path,
                requestHash,
                status: 'PROCESSING',
                expiresAt,
              },
            });

            const result = await create(tx);

            await tx.idempotencyRecord.update({
              where: {
                userId_idempotencyKey: {
                  userId: actor.id,
                  idempotencyKey: key,
                },
              },
              data: {
                status: 'COMPLETED',
                responseStatus: result.responseStatus,
                resourceType: 'MOVEMENT',
                resourceId: result.resourceId,
              },
            });

            return { replayed: false, resourceId: result.resourceId };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
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

    throw new ApiError(
      409,
      ErrorCodes.CONCURRENCY_CONFLICT,
      'No se pudo completar la operación por concurrencia. Intenta nuevamente.',
    );
  }
}
