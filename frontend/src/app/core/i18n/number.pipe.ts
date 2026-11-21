import { Pipe, PipeTransform } from '@angular/core';
import { formatNumber } from '@angular/common';
import { APP_LOCALE } from './locale';

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Números con separador decimal `.` y de miles `,` (D-30). */
@Pipe({ name: 'appNumber' })
export class AppNumberPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    digitsInfo = '1.0-2',
  ): string {
    const numeric = toNumber(value);
    return numeric === null
      ? ''
      : formatNumber(numeric, APP_LOCALE, digitsInfo);
  }
}

/** Importes en soles con el símbolo `S/` (D-30 / T-UI-01). */
@Pipe({ name: 'appCurrency' })
export class AppCurrencyPipe implements PipeTransform {
  transform(
    value: number | string | null | undefined,
    digitsInfo = '1.2-2',
  ): string {
    const numeric = toNumber(value);
    return numeric === null
      ? ''
      : `S/ ${formatNumber(numeric, APP_LOCALE, digitsInfo)}`;
  }
}
