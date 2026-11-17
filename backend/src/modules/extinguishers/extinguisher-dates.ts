import { ErrorCodes } from '../../common/errors/error-codes';

export interface CalendarDates {
  manufactureDate: Date | null;
  acquiredAt: Date | null;
  commissionedAt: Date | null;
  manufacturerExpiryDate: Date | null;
}

export interface DateValidationError {
  code: (typeof ErrorCodes)[keyof typeof ErrorCodes];
  field: keyof CalendarDates;
  message: string;
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte una fecha calendario `YYYY-MM-DD` a un `Date` en UTC.
 * Devuelve `null` si el texto no representa una fecha real (por ejemplo
 * `2025-02-30`) para no guardar fechas inventadas.
 */
export function parseCalendarDate(value: string): Date | null {
  if (!CALENDAR_DATE.test(value)) {
    return null;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10) === value ? date : null;
}

export function formatCalendarDate(date: Date | null): string | null {
  return date === null ? null : date.toISOString().slice(0, 10);
}

/**
 * Fecha de hoy en la zona configurada (D-15). Se usa para comparar fechas
 * calendario sin depender de la zona del servidor.
 */
export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function isBefore(a: Date, b: Date): boolean {
  return a.getTime() < b.getTime();
}

/**
 * Reglas documentadas de fechas del alta: fabricación no futura, adquisición
 * no anterior a fabricación, puesta en servicio no anterior a adquisición y
 * vencimiento documentado no anterior a fabricación.
 */
export function validateCalendarDates(
  dates: CalendarDates,
  today: string,
): DateValidationError | null {
  const todayDate = parseCalendarDate(today);

  if (
    dates.manufactureDate !== null &&
    todayDate !== null &&
    dates.manufactureDate.getTime() > todayDate.getTime()
  ) {
    return {
      code: ErrorCodes.DATE_IN_FUTURE,
      field: 'manufactureDate',
      message: 'La fecha de fabricación no puede ser futura.',
    };
  }

  if (
    dates.manufactureDate !== null &&
    dates.acquiredAt !== null &&
    isBefore(dates.acquiredAt, dates.manufactureDate)
  ) {
    return {
      code: ErrorCodes.DATE_BEFORE_EVENT,
      field: 'acquiredAt',
      message:
        'La fecha de adquisición no puede ser anterior a la fabricación.',
    };
  }

  const acquisitionFloor = dates.acquiredAt ?? dates.manufactureDate;
  if (
    acquisitionFloor !== null &&
    dates.commissionedAt !== null &&
    isBefore(dates.commissionedAt, acquisitionFloor)
  ) {
    return {
      code: ErrorCodes.DATE_BEFORE_EVENT,
      field: 'commissionedAt',
      message:
        'La fecha de puesta en servicio no puede ser anterior a la adquisición.',
    };
  }

  if (
    dates.manufactureDate !== null &&
    dates.manufacturerExpiryDate !== null &&
    isBefore(dates.manufacturerExpiryDate, dates.manufactureDate)
  ) {
    return {
      code: ErrorCodes.DATE_BEFORE_EVENT,
      field: 'manufacturerExpiryDate',
      message:
        'El vencimiento documentado no puede ser anterior a la fabricación.',
    };
  }

  return null;
}
