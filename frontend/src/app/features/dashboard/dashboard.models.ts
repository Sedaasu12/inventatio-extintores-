import type { TranslationKey } from '../../core/i18n/es-PE';
import type {
  DueDateEventType,
  LocationType,
  LogisticsStatus,
  MaintenanceOrderStatus,
  PlacementType,
  TechnicalCondition,
} from '../extinguishers/extinguisher.models';

/** Estados calculados por el backend para cada fecha objetivo (fase 7A). */
export const ALERT_STATUSES = [
  'VENCIDO',
  'POR_VENCER',
  'VIGENTE',
  'SIN_FECHA_CONFIGURADA',
] as const;

export type AlertStatus = (typeof ALERT_STATUSES)[number];

export type AlertStatusCounts = Record<AlertStatus, number>;

export const ALERT_STATUS_LABEL_KEYS: Record<AlertStatus, TranslationKey> = {
  VENCIDO: 'alerts.status.VENCIDO',
  POR_VENCER: 'alerts.status.POR_VENCER',
  VIGENTE: 'alerts.status.VIGENTE',
  SIN_FECHA_CONFIGURADA: 'alerts.status.SIN_FECHA_CONFIGURADA',
};

export interface DashboardLocationCount {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  count: number;
}

export interface DashboardEventTypeSummary {
  eventType: DueDateEventType;
  counts: AlertStatusCounts;
  total: number;
}

/** Contrato de `GET /dashboard/summary` (fase 7B). */
export interface DashboardSummary {
  generatedAt: string;
  assets: {
    operationalTotal: number;
    retiredTotal: number;
    byLogisticsStatus: Record<LogisticsStatus, number>;
    byTechnicalCondition: Record<TechnicalCondition, number>;
    byPlacement: Record<PlacementType, number>;
    byLocation: DashboardLocationCount[];
    withoutLocation: number;
  };
  maintenance: {
    openOrders: number;
    byStatus: Record<MaintenanceOrderStatus, number>;
    overdueReturns: number;
  };
  alerts: {
    totals: AlertStatusCounts;
    byEventType: DashboardEventTypeSummary[];
  };
}
