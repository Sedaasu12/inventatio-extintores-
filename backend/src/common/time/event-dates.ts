import { ApiError } from '../errors/api-error';
import { ErrorCodes } from '../errors/error-codes';
import { dateInTimeZone, parseCalendarDate } from './calendar';
import { assertNotBefore, assertNotFuture, parseInstant } from './instant';

/**
 * Reglas de fechas compartidas por los hechos técnicos (movimientos,
 * servicios de mantenimiento e inspecciones). El cliente envía instantes ISO
 * 8601 con zona; el servidor deriva la fecha calendario local y valida los
 * límites sin inventar periodos.
 */

/** Instante ISO 8601 con zona horaria obligatoria. */
export function parseEventInstant(value: string, field: string): Date {
  return parseInstant(value, field);
}

/**
 * Fecha calendario local (`DATE` en UTC) del instante del hecho, derivada en
 * el servidor con la zona configurada (D-15).
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
 * (D-11). El sistema no calcula intervalos: la fecha viene de un certificado,
 * proveedor o responsable autorizado.
 */
export function validateNextDueDate(
  nextDueDate: Date | null,
  performedOn: Date,
  field = 'nextDueDate',
): void {
  if (nextDueDate !== null && nextDueDate.getTime() <= performedOn.getTime()) {
    throw ApiError.unprocessable(
      ErrorCodes.PRESCRIPTION_INVALID,
      'La próxima fecha debe ser posterior a la fecha del hecho.',
      { field },
    );
  }
}

/**
 * Fecha del hecho técnico: no futura, no anterior al alta y, cuando existe
 * una orden, no anterior a su apertura.
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
