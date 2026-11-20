import { DueDateEventType } from '@prisma/client';
import { dateInTimeZone } from '../../common/time/calendar';

/**
 * Reglas puras de alertas (fase 7).
 *
 * Las alertas no se persisten: se calculan de forma determinista desde
 * `due_dates`, el estado del activo y los umbrales configurados. Sin umbral no
 * existe `POR_VENCER` (D-11 / BR-125).
 */

export const ALERT_STATUSES = [
  'VENCIDO',
  'POR_VENCER',
  'VIGENTE',
  'SIN_FECHA_CONFIGURADA',
] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const DUE_DATE_EVENT_TYPES = [
  'EQUIPO',
  'INSPECCION',
  'MANTENIMIENTO',
  'RECARGA',
  'PRUEBA_HIDROSTATICA',
] as const satisfies readonly DueDateEventType[];

export interface AlertSettingValue {
  eventType: DueDateEventType;
  daysBefore: number | null;
  enabled: boolean;
  updatedAt: Date | null;
  updatedById: string | null;
}

export interface AlertSettingRow {
  eventType: DueDateEventType;
  daysBefore: number | null;
  enabled: boolean;
  updatedAt: Date;
  updatedById: string;
}

/**
 * Combina las filas existentes con las categorías ausentes. Una categoría sin
 * fila queda habilitada y sin umbral; nunca se inventa un periodo (D-11).
 */
export function effectiveAlertSettings(
  rows: AlertSettingRow[],
): AlertSettingValue[] {
  return DUE_DATE_EVENT_TYPES.map((eventType) => {
    const row = rows.find((candidate) => candidate.eventType === eventType);
    if (row === undefined) {
      return {
        eventType,
        daysBefore: null,
        enabled: true,
        updatedAt: null,
        updatedById: null,
      };
    }
    return {
      eventType,
      daysBefore: row.daysBefore,
      enabled: row.enabled,
      updatedAt: row.updatedAt,
      updatedById: row.updatedById,
    };
  });
}

/** Fecha calendario local (`DATE` en UTC) del día actual (D-15). */
export function localToday(now: Date, timeZone: string): Date {
  return new Date(`${dateInTimeZone(now, timeZone)}T00:00:00.000Z`);
}

/** Diferencia en días entre dos fechas calendario. Negativa si ya venció. */
export function daysUntil(dueDate: Date, today: Date): number {
  return Math.round((dueDate.getTime() - today.getTime()) / 86_400_000);
}

export interface AlertClassification {
  status: AlertStatus;
  daysRemaining: number | null;
}

/**
 * Clasifica una fecha objetivo. `dueDate` debe ser un `DATE` normalizado a
 * medianoche UTC y `today` el día calendario local.
 *
 * - Sin fecha: `SIN_FECHA_CONFIGURADA`.
 * - Anterior a hoy: `VENCIDO`.
 * - Entre hoy y hoy + umbral (solo con umbral configurado): `POR_VENCER`.
 * - Resto, incluido hoy sin umbral: `VIGENTE`.
 */
export function classifyAlert(
  dueDate: Date | null,
  thresholdDays: number | null,
  today: Date,
): AlertClassification {
  if (dueDate === null) {
    return { status: 'SIN_FECHA_CONFIGURADA', daysRemaining: null };
  }

  const daysRemaining = daysUntil(dueDate, today);
  if (daysRemaining < 0) {
    return { status: 'VENCIDO', daysRemaining };
  }
  if (thresholdDays !== null && daysRemaining <= thresholdDays) {
    return { status: 'POR_VENCER', daysRemaining };
  }
  return { status: 'VIGENTE', daysRemaining };
}

export interface AlertStatusCounts {
  VENCIDO: number;
  POR_VENCER: number;
  VIGENTE: number;
  SIN_FECHA_CONFIGURADA: number;
}

export function emptyStatusCounts(): AlertStatusCounts {
  return {
    VENCIDO: 0,
    POR_VENCER: 0,
    VIGENTE: 0,
    SIN_FECHA_CONFIGURADA: 0,
  };
}
