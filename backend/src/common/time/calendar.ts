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
 * Fecha calendario (`YYYY-MM-DD`) de un instante en la zona configurada
 * (D-15). No depende de la zona horaria del servidor.
 */
export function dateInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/**
 * Fecha de hoy en la zona configurada (D-15). Se usa para comparar fechas
 * calendario sin depender de la zona del servidor.
 */
export function todayInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  return dateInTimeZone(now, timeZone);
}
