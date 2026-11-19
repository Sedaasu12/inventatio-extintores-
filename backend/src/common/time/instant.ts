import { ApiError } from '../errors/api-error';
import { ErrorCodes } from '../errors/error-codes';

/**
 * Utilidades de instantes para hechos del negocio (movimientos, servicios e
 * inspecciones). El cliente envía ISO 8601 con zona horaria; el servidor lo
 * almacena en UTC (D-15).
 */

/** Tolerancia de reloj para fechas futuras. */
export const CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

/** Instante ISO 8601 con zona horaria obligatoria. */
export const INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function isValidCalendarInstant(value: string): boolean {
  const match = INSTANT_PATTERN.exec(value);
  if (match === null) {
    return false;
  }

  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const clock = timePart.replace(/(?:Z|[+-]\d{2}:\d{2})$/, '').split('.')[0];
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
 * Convierte un instante ISO 8601 a `Date`, rechazando valores sin zona
 * horaria o con componentes de calendario inválidos (por ejemplo 31 de
 * febrero).
 */
export function parseInstant(value: string, field: string): Date {
  if (!isValidCalendarInstant(value)) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'La fecha debe ser un instante ISO 8601 válido con zona horaria.',
      { field },
    );
  }
  return new Date(value);
}

export function assertNotFuture(
  instant: Date,
  field: string,
  message = 'La fecha del hecho no puede estar en el futuro.',
  now: Date = new Date(),
  toleranceMs: number = CLOCK_TOLERANCE_MS,
): void {
  if (instant.getTime() > now.getTime() + toleranceMs) {
    throw ApiError.unprocessable(ErrorCodes.DATE_IN_FUTURE, message, { field });
  }
}

export function assertNotBefore(
  instant: Date,
  floor: Date,
  field: string,
  message: string,
): void {
  if (instant.getTime() < floor.getTime()) {
    throw ApiError.unprocessable(ErrorCodes.DATE_BEFORE_EVENT, message, {
      field,
    });
  }
}
