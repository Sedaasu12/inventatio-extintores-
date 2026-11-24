import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClientError } from '../../../core/api/api-error';
import { TranslationKey } from '../../../core/i18n/es-PE';
import { AppDatePipe } from '../../../core/i18n/date.pipe';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { PermissionService } from '../../../core/permissions/permission.service';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip';
import { ExtinguishersApi } from '../extinguishers.api';
import { conditionTone, logisticsTone } from '../extinguisher-status';
import {
  CAPACITY_UNIT_LABEL_KEYS,
  CONDITION_LABEL_KEYS,
  DUE_DATE_LABEL_KEYS,
  DueDateEventType,
  ExtinguisherDetail,
  INSPECTION_RESULT_LABEL_KEYS,
  InspectionResult,
  LOGISTICS_LABEL_KEYS,
  MAINTENANCE_STATUS_LABEL_KEYS,
  MaintenanceOrderStatus,
  PLACEMENT_LABEL_KEYS,
  PlacementType,
  TechnicalCondition,
} from '../extinguisher.models';

/**
 * Ficha completa del activo. Solo muestra acciones para las que el usuario
 * tiene permiso; el backend sigue siendo la autoridad de cada operación.
 */
@Component({
  selector: 'app-extinguisher-detail-page',
  imports: [
    RouterLink,
    TPipe,
    AppDatePipe,
    StatusChipComponent,
  ],
  templateUrl: './extinguisher-detail-page.html',
  styleUrl: './extinguisher-detail-page.scss',
})
export class ExtinguisherDetailPage {
  private readonly api = inject(ExtinguishersApi);
  private readonly permissions = inject(PermissionService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly detail = signal<ExtinguisherDetail | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly canEdit = computed(() =>
    this.permissions.has('extinguishers.update'),
  );
  readonly canChangeCondition = computed(() =>
    this.permissions.has('extinguishers.condition'),
  );

  readonly logisticsTone = logisticsTone;
  readonly conditionTone = conditionTone;

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    let successKey: TranslationKey | null = null;
    if (params.get('created') === 'true') {
      successKey = 'extinguisherDetail.created';
    } else if (params.get('updated') === 'true') {
      successKey = 'extinguisherDetail.updated';
    } else if (params.get('conditionUpdated') === 'true') {
      successKey = 'extinguisherDetail.conditionUpdated';
    }

    if (successKey !== null) {
      this.successMessage.set(this.i18n.translate(successKey));
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }

    this.load();
  }

  retry(): void {
    this.load();
  }

  logisticsKey(status: ExtinguisherDetail['logisticsStatus']): TranslationKey {
    return LOGISTICS_LABEL_KEYS[status];
  }

  conditionKey(condition: TechnicalCondition): TranslationKey {
    return CONDITION_LABEL_KEYS[condition];
  }

  placementKey(placement: PlacementType): TranslationKey {
    return PLACEMENT_LABEL_KEYS[placement];
  }

  capacityUnitKey(unit: ExtinguisherDetail['capacityUnit']): TranslationKey {
    return CAPACITY_UNIT_LABEL_KEYS[unit];
  }

  dueDateKey(eventType: DueDateEventType): TranslationKey {
    return DUE_DATE_LABEL_KEYS[eventType];
  }

  inspectionResultKey(result: InspectionResult): TranslationKey {
    return INSPECTION_RESULT_LABEL_KEYS[result];
  }

  maintenanceStatusKey(status: MaintenanceOrderStatus): TranslationKey {
    return MAINTENANCE_STATUS_LABEL_KEYS[status];
  }

  locationLabel(item: ExtinguisherDetail): string {
    if (item.currentLocation !== null) {
      return `${item.currentLocation.name} (${item.currentLocation.code})`;
    }
    if (item.currentExternalParty !== null) {
      return `${item.currentExternalParty.name} (${item.currentExternalParty.code})`;
    }
    return '—';
  }

  private load(): void {
    if (this.id === '') {
      this.loading.set(false);
      this.errorMessage.set(
        this.i18n.translate('errors.codes.ASSET_NOT_FOUND'),
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.get(this.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.detail.set(null);
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
