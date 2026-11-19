import { ErrorCodes } from '../../common/errors/error-codes';
import {
  formatCalendarDate,
  parseCalendarDate,
  todayInTimeZone,
} from '../../common/time/calendar';

export { formatCalendarDate, parseCalendarDate, todayInTimeZone };

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
