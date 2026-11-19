import { LocationType, LogisticsStatus } from '@prisma/client';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { assertNotBefore, assertNotFuture } from '../../common/time/instant';

export {
  calendarDateOf,
  parseEventInstant,
  parseOptionalCalendarDate,
  validateEventInstant,
  validateNextDueDate,
} from '../../common/time/event-dates';

/**
 * Reglas puras del ciclo de mantenimiento (fase 6).
 *
 * El servicio transaccional resuelve entidades y persiste; aquí viven las
 * validaciones que deben poder probarse sin base de datos.
 */

/**
 * El costo y la moneda son opcionales y deben ser coherentes: ambos nulos o
 * ambos informados (D-29 / BR-095 / BR-096).
 */
export function normalizeCostCurrency(
  cost: number | null | undefined,
  currency: string | null | undefined,
): { cost: number | null; currency: string | null } {
  const hasCost = cost !== null && cost !== undefined;
  const hasCurrency = currency !== null && currency !== undefined;

  if (!hasCost && !hasCurrency) {
    return { cost: null, currency: null };
  }
  if (hasCost && !hasCurrency) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'Debes indicar la moneda cuando informas un costo.',
      { field: 'currency' },
    );
  }
  if (!hasCost && hasCurrency) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'No puedes informar una moneda sin costo.',
      { field: 'cost' },
    );
  }

  const numericCost = cost as number;
  if (!Number.isFinite(numericCost) || numericCost < 0) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'El costo debe ser un número mayor o igual a cero.',
      { field: 'cost' },
    );
  }

  const normalizedCurrency = (currency as string).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'La moneda debe ser un código ISO 4217 de tres letras.',
      { field: 'currency' },
    );
  }

  return { cost: numericCost, currency: normalizedCurrency };
}

/**
 * El retorno no puede ser anterior al envío ni al último servicio registrado
 * (BR-091 / T-MAN-12).
 */
export function validateReturnInstant(
  movedAt: Date,
  orderOpenedAt: Date,
  lastServicePerformedAt: Date | null,
  now: Date = new Date(),
): void {
  assertNotFuture(
    movedAt,
    'movedAt',
    'La fecha del retorno no puede estar en el futuro.',
    now,
  );
  assertNotBefore(
    movedAt,
    orderOpenedAt,
    'movedAt',
    'La fecha del retorno no puede ser anterior al envío a mantenimiento.',
  );
  if (lastServicePerformedAt !== null) {
    assertNotBefore(
      movedAt,
      lastServicePerformedAt,
      'movedAt',
      'La fecha del retorno no puede ser anterior al último servicio registrado.',
    );
  }
}

/**
 * Estado logístico al volver de mantenimiento. El retorno solo admite
 * almacén o área (supuesto de fase 6); el taller queda para el envío.
 */
export function statusForReturnLocation(type: LocationType): LogisticsStatus {
  if (type === 'ALMACEN') {
    return 'EN_ALMACEN';
  }
  if (type === 'AREA') {
    return 'ASIGNADO';
  }
  throw ApiError.unprocessable(
    ErrorCodes.DESTINATION_INVALID,
    'El retorno debe registrarse en un almacén o área activos.',
    { field: 'destinationLocationId' },
  );
}

export function assertNotRetired(asset: {
  logisticsStatus: LogisticsStatus;
}): void {
  if (asset.logisticsStatus === 'DADO_DE_BAJA') {
    throw new ApiError(
      409,
      ErrorCodes.ASSET_RETIRED,
      'El extintor está dado de baja y no admite operaciones técnicas.',
    );
  }
}
