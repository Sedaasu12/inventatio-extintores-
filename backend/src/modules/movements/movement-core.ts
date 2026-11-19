import {
  LocationType,
  LogisticsStatus,
  MaintenanceOrderStatus,
  MovementType,
  PlacementType,
  Prisma,
  TechnicalCondition,
} from '@prisma/client';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import {
  EXTINGUISHER_DETAIL_SELECT,
  toExtinguisherDetail,
} from '../extinguishers/extinguisher-view';
import type { AssetMovementState } from './movement-policy';
import { MOVEMENT_SELECT, toMovementView } from './movement-view';

/**
 * Primitivas compartidas por el motor de movimientos (fase 5) y los flujos de
 * mantenimiento e inspecciones (fase 6). No contiene reglas de negocio: solo
 * bloqueo, lectura consistente y snapshots.
 */

/** Estados de orden que cuentan como activos (BR-081). */
export const ACTIVE_MAINTENANCE_STATUSES = ['ABIERTA', 'EN_PROVEEDOR'] as const;

export type Tx = Prisma.TransactionClient;

export interface ActiveOrderSummary {
  id: string;
  status: MaintenanceOrderStatus;
  providerId: string | null;
  workshopLocationId: string | null;
  openedAt: Date;
  sentMovementId: string;
}

export interface LockedAsset {
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
  activeOrder: ActiveOrderSummary | null;
  hasActiveMaintenanceOrder: boolean;
}

export interface EndpointSnapshot {
  kind: 'LOCATION' | 'EXTERNAL_PARTY' | 'NONE';
  locationId: string | null;
  externalPartyId: string | null;
  label: string;
}

export interface LocationSummary {
  id: string;
  code: string;
  name: string;
  type: LocationType;
}

export interface MovementOperationBody {
  movement: ReturnType<typeof toMovementView>;
  extinguisher: ReturnType<typeof toExtinguisherDetail>;
}

export interface MovementOperationResult {
  replayed: boolean;
  body: MovementOperationBody;
}

export function assetNotFound(): ApiError {
  return new ApiError(
    404,
    ErrorCodes.ASSET_NOT_FOUND,
    'El extintor no existe.',
  );
}

export function normalizeOptionalText(
  value: string | null | undefined,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function locationLabel(location: {
  code: string;
  name: string;
}): string {
  return `${location.code} - ${location.name}`;
}

export function requireText(value: string | undefined, field: string): string {
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

/**
 * Bloquea la fila del extintor y devuelve su proyección, el último movimiento
 * y la orden de mantenimiento activa si existe. Debe ejecutarse dentro de una
 * transacción.
 */
export async function lockAsset(
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
      select: {
        id: true,
        status: true,
        providerId: true,
        workshopLocationId: true,
        openedAt: true,
        sentMovementId: true,
      },
    }),
  ]);

  return {
    ...asset,
    lastMovement,
    activeOrder,
    hasActiveMaintenanceOrder: activeOrder !== null,
  };
}

export function toPolicyState(asset: LockedAsset): AssetMovementState {
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

export function assertRowVersion(asset: LockedAsset, expected: number): void {
  if (asset.rowVersion !== expected) {
    throw new ApiError(
      409,
      ErrorCodes.CONCURRENCY_CONFLICT,
      'El extintor fue modificado por otra operación. Recarga e intenta de nuevo.',
      { field: 'rowVersion', expected: asset.rowVersion, received: expected },
    );
  }
}

export function nextSequence(asset: LockedAsset): number {
  return (asset.lastMovement?.assetSequence ?? 0) + 1;
}

export function snapshotOrigin(asset: LockedAsset): EndpointSnapshot {
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

/**
 * Resuelve una ubicación activa para un movimiento. Devuelve solo los campos
 * necesarios para el snapshot y la validación de destino.
 */
export async function resolveActiveLocation(
  tx: Tx,
  locationId: string,
  field = 'destinationLocationId',
  message = 'La ubicación de destino no existe o está inactiva.',
): Promise<LocationSummary> {
  const location = await tx.location.findUnique({
    where: { id: locationId },
    select: { id: true, code: true, name: true, type: true, active: true },
  });
  if (location === null || !location.active) {
    throw ApiError.unprocessable(ErrorCodes.DESTINATION_INVALID, message, {
      field,
    });
  }
  return {
    id: location.id,
    code: location.code,
    name: location.name,
    type: location.type,
  };
}

export async function buildMovementBody(
  client: PrismaService | Tx,
  movementId: string,
): Promise<MovementOperationBody> {
  const movement = await client.movement.findUniqueOrThrow({
    where: { id: movementId },
    select: MOVEMENT_SELECT,
  });
  const extinguisher = await client.extinguisher.findUniqueOrThrow({
    where: { id: movement.extinguisherId },
    select: EXTINGUISHER_DETAIL_SELECT,
  });

  return {
    movement: toMovementView(movement),
    extinguisher: toExtinguisherDetail(extinguisher),
  };
}
