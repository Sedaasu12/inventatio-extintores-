import { Pipe, PipeTransform } from '@angular/core';
import { formatDate } from '@angular/common';
import { APP_LOCALE, APP_TIME_ZONE } from './locale';

/** Fecha de calendario (`AAAA-MM-DD`) sin desplazamiento de zona. */
export function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formatea fechas con el formato local `dd/MM/yyyy` (D-30).
 *
 * Las fechas de calendario que envía la API (`2026-01-01`) se interpretan como
 * UTC para que no retrocedan un día; los instantes con hora se muestran en la
 * zona `America/Lima`.
 */
@Pipe({ name: 'appDate' })
export class AppDatePipe implements PipeTransform {
  transform(
    value: string | Date | null | undefined,
    format = 'dd/MM/yyyy',
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime())
        ? ''
        : formatDate(value, format, APP_LOCALE, APP_TIME_ZONE);
    }
    const calendar = parseCalendarDate(value);
    if (calendar !== null) {
      return formatDate(calendar, format, APP_LOCALE, 'UTC');
    }
    const instant = new Date(value);
    return Number.isNaN(instant.getTime())
      ? ''
      : formatDate(instant, format, APP_LOCALE, APP_TIME_ZONE);
  }
}
