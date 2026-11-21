import { AppDatePipe } from './date.pipe';
import { AppCurrencyPipe, AppNumberPipe } from './number.pipe';

describe('pipes de presentación (D-30 / T-UI-01)', () => {
  const date = new AppDatePipe();
  const number = new AppNumberPipe();
  const currency = new AppCurrencyPipe();

  it('muestra las fechas de calendario como dd/mm/aaaa sin retroceder un día', () => {
    expect(date.transform('2026-01-01')).toBe('01/01/2026');
    expect(date.transform('2024-02-29')).toBe('29/02/2024');
  });

  it('muestra los instantes en la zona America/Lima', () => {
    expect(date.transform('2026-11-20T02:40:00.000Z', 'dd/MM/yyyy HH:mm')).toBe(
      '19/11/2026 21:40',
    );
  });

  it('devuelve vacío para valores ausentes o inválidos', () => {
    expect(date.transform(null)).toBe('');
    expect(date.transform(undefined)).toBe('');
    expect(date.transform('no-es-fecha')).toBe('');
    expect(number.transform(null)).toBe('');
    expect(number.transform('abc')).toBe('');
    expect(currency.transform(undefined)).toBe('');
  });

  it('usa coma para miles y punto para decimales', () => {
    expect(number.transform(1234.5, '1.2-2')).toBe('1,234.50');
    expect(number.transform(0, '1.0-0')).toBe('0');
  });

  it('presenta importes en soles', () => {
    expect(currency.transform(1234.5)).toMatch(/S\/\s?1,234\.50/);
  });
});
