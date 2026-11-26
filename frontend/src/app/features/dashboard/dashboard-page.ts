import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiClientError } from '../../core/api/api-error';
import { AppDatePipe } from '../../core/i18n/date.pipe';
import { AppNumberPipe } from '../../core/i18n/number.pipe';
import type { TranslationKey } from '../../core/i18n/es-PE';
import { I18nService } from '../../core/i18n/i18n.service';
import { TPipe } from '../../core/i18n/t.pipe';
import { PermissionService } from '../../core/permissions/permission.service';
import {
  DataTableColumn,
  DataTableComponent,
} from '../../shared/components/data-table/data-table';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state';
import { type StatusTone } from '../../shared/components/status-chip/status-chip';
import { conditionTone, logisticsTone } from '../extinguishers/extinguisher-status';
import {
  CONDITION_LABEL_KEYS,
  DUE_DATE_LABEL_KEYS,
  LOCATION_TYPE_LABEL_KEYS,
  LOGISTICS_LABEL_KEYS,
  LOGISTICS_STATUSES,
  MAINTENANCE_STATUS_LABEL_KEYS,
  PLACEMENT_LABEL_KEYS,
  TECHNICAL_CONDITIONS,
  type DueDateEventType,
  type LocationType,
  type LogisticsStatus,
  type MaintenanceOrderStatus,
  type PlacementType,
  type TechnicalCondition,
} from '../extinguishers/extinguisher.models';
import { DashboardApi } from './dashboard.api';
import {
  ALERT_STATUSES,
  ALERT_STATUS_LABEL_KEYS,
  type AlertStatus,
  type DashboardSummary,
} from './dashboard.models';

interface MetricRow {
  key: string;
  labelKey: TranslationKey;
  count: number;
  tone?: StatusTone;
}

const MAINTENANCE_STATUSES: readonly MaintenanceOrderStatus[] = [
  'ABIERTA',
  'EN_PROVEEDOR',
  'CERRADA',
  'CANCELADA',
];

const PLACEMENTS: readonly PlacementType[] = ['INTERNAL', 'EXTERNAL', 'NONE'];

const ALERT_TONES: Record<AlertStatus, StatusTone> = {
  VENCIDO: 'danger',
  POR_VENCER: 'warning',
  VIGENTE: 'success',
  SIN_FECHA_CONFIGURADA: 'neutral',
};

/**
 * Tablero de inicio. Todos los conteos provienen de `GET /dashboard/summary`:
 * la pantalla no recalcula estados ni alertas, solo los presenta.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [
    RouterLink,
    TPipe,
    AppDatePipe,
    AppNumberPipe,
    DataTableComponent,
    EmptyStateComponent,
  ],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.scss',
})
export class DashboardPage {
  private readonly api = inject(DashboardApi);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionService);

  readonly alertStatuses = ALERT_STATUSES;

  readonly summary = signal<DashboardSummary | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly canReadInventory = computed(() =>
    this.permissions.has('extinguishers.read'),
  );
  readonly canCreate = computed(() =>
    this.permissions.has('extinguishers.create'),
  );
  readonly hasAssets = computed(() => {
    const summary = this.summary();
    return (
      summary !== null &&
      summary.assets.operationalTotal + summary.assets.retiredTotal > 0
    );
  });

  readonly logisticsRows = computed<MetricRow[]>(() => {
    const summary = this.summary();
    if (summary === null) {
      return [];
    }
    return LOGISTICS_STATUSES.map((status: LogisticsStatus) => ({
      key: status,
      labelKey: LOGISTICS_LABEL_KEYS[status],
      count: summary.assets.byLogisticsStatus[status],
      tone: logisticsTone(status),
    }));
  });

  readonly conditionRows = computed<MetricRow[]>(() => {
    const summary = this.summary();
    if (summary === null) {
      return [];
    }
    return TECHNICAL_CONDITIONS.map((condition: TechnicalCondition) => ({
      key: condition,
      labelKey: CONDITION_LABEL_KEYS[condition],
      count: summary.assets.byTechnicalCondition[condition],
      tone: conditionTone(condition),
    }));
  });

  readonly placementRows = computed<MetricRow[]>(() => {
    const summary = this.summary();
    if (summary === null) {
      return [];
    }
    return PLACEMENTS.map((placement) => ({
      key: placement,
      labelKey: PLACEMENT_LABEL_KEYS[placement],
      count: summary.assets.byPlacement[placement],
    }));
  });

  readonly maintenanceRows = computed<MetricRow[]>(() => {
    const summary = this.summary();
    if (summary === null) {
      return [];
    }
    return MAINTENANCE_STATUSES.map((status) => ({
      key: status,
      labelKey: MAINTENANCE_STATUS_LABEL_KEYS[status],
      count: summary.maintenance.byStatus[status],
    }));
  });

  readonly alertRows = computed<MetricRow[]>(() => {
    const summary = this.summary();
    if (summary === null) {
      return [];
    }
    return ALERT_STATUSES.map((status) => ({
      key: status,
      labelKey: ALERT_STATUS_LABEL_KEYS[status],
      count: summary.alerts.totals[status],
      tone: ALERT_TONES[status],
    }));
  });

  readonly locationColumns: readonly DataTableColumn[] = [
    { key: 'location', header: this.i18n.translate('dashboard.columns.location') },
    { key: 'type', header: this.i18n.translate('dashboard.columns.type') },
    {
      key: 'count',
      header: this.i18n.translate('dashboard.columns.count'),
      align: 'end',
    },
  ];

  readonly eventColumns: readonly DataTableColumn[] = [
    { key: 'event', header: this.i18n.translate('dashboard.columns.event') },
    ...ALERT_STATUSES.map((status) => ({
      key: status,
      header: this.i18n.translate(ALERT_STATUS_LABEL_KEYS[status]),
      align: 'end' as const,
    })),
    {
      key: 'total',
      header: this.i18n.translate('dashboard.columns.total'),
      align: 'end',
    },
  ];

  constructor() {
    this.load();
  }

  retry(): void {
    this.load();
  }

  dueDateKey(eventType: DueDateEventType): TranslationKey {
    return DUE_DATE_LABEL_KEYS[eventType];
  }

  locationTypeKey(type: LocationType): TranslationKey {
    return LOCATION_TYPE_LABEL_KEYS[type];
  }

  alertStatusKey(status: AlertStatus): TranslationKey {
    return ALERT_STATUS_LABEL_KEYS[status];
  }

  alertTone(status: AlertStatus): StatusTone {
    return ALERT_TONES[status];
  }

  private load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.summary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.summary.set(null);
        this.errorMessage.set(
          error instanceof ApiClientError
            ? this.i18n.translateError(error)
            : this.i18n.translate('errors.generic'),
        );
        this.loading.set(false);
      },
    });
  }
}
