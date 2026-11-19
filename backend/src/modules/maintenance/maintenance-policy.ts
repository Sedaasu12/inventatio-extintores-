import { LocationType, LogisticsStatus } from '@prisma/client';
import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';
import { dateInTimeZone, parseCalendarDate } from '../../common/time/calendar';
import {
  assertNotBefore,
  assertNotFuture,
  parseInstant,
} from '../../common/time/instant';

/**
 * Reglas puras del ciclo de mantenimiento (fase 6).
 *
 * El servicio transaccional resuelve entidades y persiste; aquí viven las
 * validaciones que deben poder probarse sin base de datos.
 */

export function parseEventInstant(value: string, field: string): Date {
  return parseInstant(value, field);
}

/**
 * Fecha calendario local (`DATE` en UTC) del instante del hecho, derivada en
 * el servidor con la zona configurada (BR-114).
 */
export function calendarDateOf(instant: Date, timeZone: string): Date {
  return new Date(`${dateInTimeZone(instant, timeZone)}T00:00:00.000Z`);
}

/** Fecha calendario opcional; rechaza formatos y fechas irreales. */
export function parseOptionalCalendarDate(
  value: string | undefined,
  field: string,
): Date | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }
  const parsed = parseCalendarDate(value.trim());
  if (parsed === null) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'La fecha debe tener el formato AAAA-MM-DD y ser una fecha real.',
      { field },
    );
  }
  return parsed;
}

/**
 * La próxima fecha indicada debe ser posterior a la fecha local del hecho
 * (BR-101 / BR-113). El sistema no calcula intervalos (BR-108A).
 */
export function validateNextDueDate(
  nextDueDate: Date | null,
  performedOn: Date,
  field = 'nextDueDate',
): void {
  if (nextDueDate !== null && nextDueDate.getTime() <= performedOn.getTime()) {
    throw ApiError.unprocessable(
      ErrorCodes.PRESCRIPTION_INVALID,
      'La próxima fecha debe ser posterior a la fecha del servicio.',
      { field },
    );
  }
}

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
 * Fecha del hecho técnico: no futura, no anterior al alta y, cuando existe
 * orden, no anterior a su apertura.
 */
export function validateEventInstant(
  instant: Date,
  options: {
    assetCreatedAt: Date;
    orderOpenedAt?: Date | null;
    field: string;
    now?: Date;
  },
): void {
  assertNotFuture(
    instant,
    options.field,
    'La fecha del hecho no puede estar en el futuro.',
    options.now ?? new Date(),
  );
  assertNotBefore(
    instant,
    options.assetCreatedAt,
    options.field,
    'La fecha del hecho no puede ser anterior al alta del extintor.',
  );
  if (options.orderOpenedAt !== undefined && options.orderOpenedAt !== null) {
    assertNotBefore(
      instant,
      options.orderOpenedAt,
      options.field,
      'La fecha del hecho no puede ser anterior a la apertura de la orden.',
    );
  }
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
