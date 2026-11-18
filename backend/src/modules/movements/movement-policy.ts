import {
  LogisticsStatus,
  LocationType,
  PlacementType,
  TechnicalCondition,
} from '@prisma/client';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';

/**
 * Política pura del motor de movimientos (fase 5).
 *
 * Concentra la matriz de transiciones, la validación del origen y destino y
 * las reglas de fechas. El servicio transaccional solo resuelve entidades y
 * persiste; no repite estas decisiones.
 */

export const OPERATIONAL_MOVEMENT_TYPES = [
  'SALIDA',
  'TRASLADO',
  'RETORNO_ALMACEN',
] as const;

export type OperationalMovementType =
  (typeof OPERATIONAL_MOVEMENT_TYPES)[number];

/** Tolerancia de reloj para fechas futuras (BR-056). */
export const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/** Instante ISO 8601 con zona horaria obligatoria. */
export const MOVED_AT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export interface AssetMovementState {
  id: string;
  logisticsStatus: LogisticsStatus;
  technicalCondition: TechnicalCondition;
  placementType: PlacementType;
  currentLocationId: string | null;
  currentLocationType: LocationType | null;
  currentExternalPartyId: string | null;
  createdAt: Date;
  /** `movedAt` del movimiento con la secuencia más alta, si existe. */
  lastMovementAt: Date | null;
  hasActiveMaintenanceOrder: boolean;
}

export type PlacementTarget =
  | {
      kind: 'INTERNAL';
      locationId: string;
      locationType: LocationType;
    }
  | {
      kind: 'EXTERNAL';
      externalPartyId: string;
    };

export interface OperationalMovementInput {
  type: OperationalMovementType;
  originLocationId: string;
  destinationLocationId: string;
  destinationLocationType: LocationType;
  asset: AssetMovementState;
}

export interface OperationalMovementResult {
  logisticsStatus: LogisticsStatus;
}

export interface AdjustmentInput {
  asset: AssetMovementState;
  target: PlacementTarget;
  /** Movimiento referenciado por `correctsMovementId`, ya validado como del activo. */
  correctsMovement: { id: string; movementType: string } | null;
}

export interface AdjustmentResult {
  logisticsStatus: LogisticsStatus;
  reactivates: boolean;
}

function isValidCalendarInstant(value: string): boolean {
  const match = MOVED_AT_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const clock = timePart.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '');
  const [hour, minute, second = 0] = clock.split(':').map(Number);

  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day) ||
    Number.isNaN(hour) ||
    Number.isNaN(minute) ||
    Number.isNaN(second)
  ) {
    return false;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day &&
    !Number.isNaN(new Date(value).getTime())
  );
}

/**
 * Convierte `movedAt` a `Date` rechazando valores sin zona horaria o con
 * componentes de calendario inválidos (por ejemplo 31 de febrero).
 */
export function parseMovedAt(value: string): Date {
  if (!isValidCalendarInstant(value)) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'La fecha del movimiento debe ser un instante ISO 8601 válido con zona horaria.',
      { field: 'movedAt' },
    );
  }
  return new Date(value);
}

export function validateMovedAt(
  movedAt: Date,
  asset: Pick<AssetMovementState, 'createdAt' | 'lastMovementAt'>,
  now: Date = new Date(),
): void {
  if (movedAt.getTime() > now.getTime() + CLOCK_TOLERANCE_MS) {
    throw ApiError.unprocessable(
      ErrorCodes.DATE_IN_FUTURE,
      'La fecha del movimiento no puede estar en el futuro.',
      { field: 'movedAt' },
    );
  }

  if (movedAt.getTime() < asset.createdAt.getTime()) {
    throw ApiError.unprocessable(
      ErrorCodes.DATE_BEFORE_EVENT,
      'La fecha del movimiento no puede ser anterior al alta del extintor.',
      { field: 'movedAt' },
    );
  }

  if (
    asset.lastMovementAt !== null &&
    movedAt.getTime() < asset.lastMovementAt.getTime()
  ) {
    throw ApiError.unprocessable(
      ErrorCodes.DATE_BEFORE_EVENT,
      'La fecha del movimiento no puede ser anterior al último movimiento. Usa un ajuste si necesitas corregir el historial.',
      { field: 'movedAt' },
    );
  }
}

function originMismatch(expected: string | null, received: string): ApiError {
  return new ApiError(
    409,
    ErrorCodes.ORIGIN_MISMATCH,
    'El origen indicado no coincide con la ubicación actual del extintor.',
    { field: 'originLocationId', expected, received },
  );
}

function invalidTransition(message: string): ApiError {
  return new ApiError(409, ErrorCodes.INVALID_TRANSITION, message);
}

function invalidDestination(
  message: string,
  field = 'destinationLocationId',
): ApiError {
  return ApiError.unprocessable(ErrorCodes.DESTINATION_INVALID, message, {
    field,
  });
}

function assertAssetMovable(asset: AssetMovementState): void {
  if (asset.logisticsStatus === 'DADO_DE_BAJA') {
    throw new ApiError(
      409,
      ErrorCodes.ASSET_RETIRED,
      'El extintor está dado de baja y no admite movimientos ordinarios.',
    );
  }
  if (asset.logisticsStatus === 'EN_MANTENIMIENTO') {
    throw invalidTransition(
      'El extintor está en mantenimiento. Registra el retorno antes de moverlo.',
    );
  }
}

function assertInternalOrigin(
  asset: AssetMovementState,
  originLocationId: string,
): LocationType {
  if (asset.placementType !== 'INTERNAL' || asset.currentLocationId === null) {
    throw originMismatch(asset.currentLocationId, originLocationId);
  }
  if (asset.currentLocationId !== originLocationId) {
    throw originMismatch(asset.currentLocationId, originLocationId);
  }
  if (asset.currentLocationType === null) {
    throw originMismatch(asset.currentLocationId, originLocationId);
  }
  return asset.currentLocationType;
}

export function resolveDestinationStatus(
  type: OperationalMovementType,
  destinationLocationType: LocationType,
): LogisticsStatus {
  if (type === 'SALIDA') {
    return 'ASIGNADO';
  }
  if (type === 'RETORNO_ALMACEN') {
    return 'EN_ALMACEN';
  }
  return destinationLocationType === 'ALMACEN' ? 'EN_ALMACEN' : 'ASIGNADO';
}

/**
 * Valida `SALIDA`, `TRASLADO` y `RETORNO_ALMACEN` (BR-042..BR-065, D-26b).
 */
export function validateOperationalMovement(
  input: OperationalMovementInput,
): OperationalMovementResult {
  const { asset, type } = input;

  assertAssetMovable(asset);
  const originType = assertInternalOrigin(asset, input.originLocationId);

  if (type === 'SALIDA') {
    if (asset.logisticsStatus !== 'EN_ALMACEN' || originType !== 'ALMACEN') {
      throw invalidTransition(
        'La salida solo se registra desde un almacén con el extintor en almacén.',
      );
    }
  } else if (type === 'TRASLADO') {
    if (
      (asset.logisticsStatus !== 'EN_ALMACEN' &&
        asset.logisticsStatus !== 'ASIGNADO') ||
      (originType !== 'ALMACEN' && originType !== 'AREA')
    ) {
      throw invalidTransition(
        'El traslado solo aplica entre almacenes o entre áreas.',
      );
    }
  } else if (asset.logisticsStatus !== 'ASIGNADO' || originType !== 'AREA') {
    throw invalidTransition(
      'El retorno a almacén solo aplica a un extintor asignado a un área.',
    );
  }

  if (input.destinationLocationId === input.originLocationId) {
    throw invalidDestination('El destino no puede ser igual al origen.');
  }

  if (type === 'SALIDA' && input.destinationLocationType !== 'AREA') {
    throw invalidDestination(
      'La salida debe tener como destino un área interna.',
    );
  }
  if (
    type === 'RETORNO_ALMACEN' &&
    input.destinationLocationType !== 'ALMACEN'
  ) {
    throw invalidDestination('El retorno debe tener como destino un almacén.');
  }
  if (type === 'TRASLADO') {
    if (
      originType === 'ALMACEN' &&
      input.destinationLocationType !== 'ALMACEN'
    ) {
      throw invalidDestination(
        'El traslado entre almacenes debe terminar en otro almacén.',
      );
    }
    if (originType === 'AREA' && input.destinationLocationType !== 'AREA') {
      throw invalidDestination(
        'El traslado entre áreas debe terminar en otra área. Usa el retorno a almacén para volver.',
      );
    }
  }

  if (
    asset.technicalCondition === 'NO_OPERATIVO' &&
    input.destinationLocationType === 'AREA'
  ) {
    throw ApiError.unprocessable(
      ErrorCodes.CONDITION_NOT_ASSIGNABLE,
      'Un extintor NO_OPERATIVO no puede asignarse a un área.',
      { field: 'destinationLocationId' },
    );
  }

  return {
    logisticsStatus: resolveDestinationStatus(
      type,
      input.destinationLocationType,
    ),
  };
}

/**
 * Valida una baja directa (BR-069, BR-070, D-17).
 */
export function validateRetirement(asset: AssetMovementState): void {
  if (asset.logisticsStatus === 'DADO_DE_BAJA') {
    throw new ApiError(
      409,
      ErrorCodes.ASSET_RETIRED,
      'El extintor ya está dado de baja.',
    );
  }
  if (asset.hasActiveMaintenanceOrder) {
    throw new ApiError(
      409,
      ErrorCodes.MAINTENANCE_ORDER_ACTIVE,
      'No se puede dar de baja un extintor con una orden de mantenimiento activa.',
    );
  }
  if (
    (asset.logisticsStatus !== 'EN_ALMACEN' &&
      asset.logisticsStatus !== 'ASIGNADO') ||
    asset.placementType !== 'INTERNAL' ||
    asset.currentLocationId === null
  ) {
    throw invalidTransition(
      'Solo se puede dar de baja un extintor ubicado en un almacén o área interna.',
    );
  }
}

/**
 * Valida un ajuste excepcional (BR-062, BR-071, BR-072).
 */
export function validateAdjustment(input: AdjustmentInput): AdjustmentResult {
  const { asset, target, correctsMovement } = input;
  const reactivates = asset.logisticsStatus === 'DADO_DE_BAJA';

  if (target.kind === 'INTERNAL' && target.locationType === 'SEDE') {
    throw invalidDestination(
      'La sede no es una colocación válida para un extintor.',
      'locationId',
    );
  }

  if (reactivates) {
    if (correctsMovement === null) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'Para reactivar un extintor dado de baja debes indicar el movimiento de baja corregido.',
        { field: 'correctsMovementId' },
      );
    }
    if (correctsMovement.movementType !== 'BAJA') {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El movimiento corregido debe ser la baja del extintor.',
        { field: 'correctsMovementId' },
      );
    }
  }

  if (isSamePlacement(asset, target)) {
    throw invalidDestination(
      'El ajuste debe cambiar la colocación actual del extintor.',
      target.kind === 'INTERNAL' ? 'locationId' : 'externalPartyId',
    );
  }

  if (
    asset.technicalCondition === 'NO_OPERATIVO' &&
    target.kind === 'INTERNAL' &&
    target.locationType === 'AREA'
  ) {
    throw ApiError.unprocessable(
      ErrorCodes.CONDITION_NOT_ASSIGNABLE,
      'Un extintor NO_OPERATIVO no puede ajustarse a un área.',
      { field: 'locationId' },
    );
  }

  return {
    logisticsStatus: placementStatus(target),
    reactivates,
  };
}

function isSamePlacement(
  asset: AssetMovementState,
  target: PlacementTarget,
): boolean {
  if (asset.placementType === 'NONE') {
    return false;
  }
  if (target.kind === 'INTERNAL') {
    return (
      asset.placementType === 'INTERNAL' &&
      asset.currentLocationId === target.locationId
    );
  }
  return (
    asset.placementType === 'EXTERNAL' &&
    asset.currentExternalPartyId === target.externalPartyId
  );
}

export function placementStatus(target: PlacementTarget): LogisticsStatus {
  if (target.kind === 'EXTERNAL') {
    return 'EN_MANTENIMIENTO';
  }
  if (target.locationType === 'ALMACEN') {
    return 'EN_ALMACEN';
  }
  if (target.locationType === 'AREA') {
    return 'ASIGNADO';
  }
  return 'EN_MANTENIMIENTO';
}
