import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  RouterLink,
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClientError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslationKey } from '../../../core/i18n/es-PE';
import { TPipe } from '../../../core/i18n/t.pipe';
import { AppDatePipe } from '../../../core/i18n/date.pipe';
import { PermissionService } from '../../../core/permissions/permission.service';
import { DataTableColumn, DataTableComponent } from '../../../shared/components/data-table/data-table';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state';
import { PaginationComponent } from '../../../shared/components/pagination/pagination';
import {
  StatusChipComponent,
} from '../../../shared/components/status-chip/status-chip';
import { ExtinguishersApi } from '../extinguishers.api';
import { conditionTone, logisticsTone } from '../extinguisher-status';
import {
  CONDITION_LABEL_KEYS,
  EXTINGUISHER_SORTS,
  ExtinguisherFilters,
  ExtinguisherSort,
  ExtinguisherSummary,
  ListMeta,
  LocationNode,
  LOGISTICS_LABEL_KEYS,
  LOGISTICS_STATUSES,
  LogisticsStatus,
  SORT_LABEL_KEYS,
  TECHNICAL_CONDITIONS,
  TechnicalCondition,
  defaultExtinguisherFilters,
  isExtinguisherSort,
  isLogisticsStatus,
  isTechnicalCondition,
} from '../extinguisher.models';

interface LocationGroup {
  sede: LocationNode;
  options: LocationNode[];
}

const LOGISTICS_OPTIONS = LOGISTICS_STATUSES.map((value) => ({
  value,
  labelKey: LOGISTICS_LABEL_KEYS[value],
}));

const CONDITION_OPTIONS = TECHNICAL_CONDITIONS.map((value) => ({
  value,
  labelKey: CONDITION_LABEL_KEYS[value],
}));

const SORT_OPTIONS = EXTINGUISHER_SORTS.map((value) => ({
  value,
  labelKey: SORT_LABEL_KEYS[value],
}));

function parsePositiveInteger(value: string | null): number {
  if (value === null) {
    return 1;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

function parseFilters(params: ParamMap): ExtinguisherFilters {
  const sortValue = params.get('sort') ?? 'assetCode';
  const statusValue = params.get('logisticsStatus') ?? '';
  const conditionValue = params.get('technicalCondition') ?? '';

  return {
    q: params.get('q') ?? '',
    typeId: params.get('typeId') ?? '',
    locationId: params.get('locationId') ?? '',
    logisticsStatus: isLogisticsStatus(statusValue) ? statusValue : '',
    technicalCondition: isTechnicalCondition(conditionValue)
      ? conditionValue
      : '',
    includeRetired: params.get('includeRetired') === 'true',
    sort: isExtinguisherSort(sortValue) ? sortValue : 'assetCode',
    page: parsePositiveInteger(params.get('page')),
  };
}

function toQueryParams(
  filters: ExtinguisherFilters,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.q !== '') {
    params['q'] = filters.q;
  }
  if (filters.typeId !== '') {
    params['typeId'] = filters.typeId;
  }
  if (filters.locationId !== '') {
    params['locationId'] = filters.locationId;
  }
  if (filters.logisticsStatus !== '') {
    params['logisticsStatus'] = filters.logisticsStatus;
  }
  if (filters.technicalCondition !== '') {
    params['technicalCondition'] = filters.technicalCondition;
  }
  if (filters.includeRetired) {
    params['includeRetired'] = 'true';
  }
  if (filters.sort !== 'assetCode') {
    params['sort'] = filters.sort;
  }
  if (filters.page > 1) {
    params['page'] = String(filters.page);
  }
  return params;
}

function queryKey(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * Listado de inventario. Los filtros y la página viven en la URL para que la
 * vista se pueda compartir y sobreviva a una recarga; la API aplica todos los
 * filtros y la paginación en el servidor.
 */
@Component({
  selector: 'app-extinguisher-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TPipe,
    AppDatePipe,
    DataTableComponent,
    EmptyStateComponent,
    PaginationComponent,
    StatusChipComponent,
  ],
  templateUrl: './extinguisher-list-page.html',
  styleUrl: './extinguisher-list-page.scss',
})
export class ExtinguisherListPage {
  private readonly api = inject(ExtinguishersApi);
  private readonly permissions = inject(PermissionService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  readonly canReadCatalogs = computed(() =>
    this.permissions.has('catalogs.read'),
  );
  readonly canReadLocations = computed(() =>
    this.permissions.has('locations.read'),
  );
  readonly canCreate = computed(() =>
    this.permissions.has('extinguishers.create'),
  );

  readonly form = this.formBuilder.nonNullable.group({
    q: ['', [Validators.maxLength(100)]],
    typeId: [''],
    locationId: [''],
    logisticsStatus: [''],
    technicalCondition: [''],
    includeRetired: [false],
    sort: ['assetCode'],
  });

  readonly filters = signal<ExtinguisherFilters>(
    defaultExtinguisherFilters(),
  );
  readonly loading = signal(true);
  readonly items = signal<ExtinguisherSummary[]>([]);
  readonly meta = signal<ListMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  readonly errorMessage = signal<string | null>(null);
  readonly filterOptionsError = signal<string | null>(null);
  readonly types = signal<{ id: string; code: string; name: string }[]>([]);
  readonly locations = signal<LocationNode[]>([]);

  readonly logisticsOptions = LOGISTICS_OPTIONS;
  readonly conditionOptions = CONDITION_OPTIONS;
  readonly sortOptions = SORT_OPTIONS;

  readonly locationGroups = computed<LocationGroup[]>(() =>
    this.locations().map((sede) => ({
      sede,
      options: [sede, ...sede.children],
    })),
  );

  readonly hasActiveFilters = computed(() => {
    const filters = this.filters();
    return (
      filters.q !== '' ||
      filters.typeId !== '' ||
      filters.locationId !== '' ||
      filters.logisticsStatus !== '' ||
      filters.technicalCondition !== '' ||
      filters.includeRetired ||
      filters.sort !== 'assetCode' ||
      filters.page > 1
    );
  });

  readonly columns = computed<DataTableColumn[]>(() => [
    {
      key: 'assetCode',
      header: this.i18n.translate('inventory.columns.assetCode'),
    },
    {
      key: 'type',
      header: this.i18n.translate('inventory.columns.type'),
    },
    {
      key: 'location',
      header: this.i18n.translate('inventory.columns.location'),
    },
    {
      key: 'logisticsStatus',
      header: this.i18n.translate('inventory.columns.logisticsStatus'),
    },
    {
      key: 'technicalCondition',
      header: this.i18n.translate('inventory.columns.technicalCondition'),
    },
    {
      key: 'serialNumber',
      header: this.i18n.translate('inventory.columns.serialNumber'),
    },
    {
      key: 'updatedAt',
      header: this.i18n.translate('inventory.columns.updatedAt'),
    },
  ]);

  readonly tableCaption = computed(() =>
    this.i18n.translate('inventory.tableCaption'),
  );

  readonly resultsSummary = computed(() =>
    this.i18n.translate('inventory.results', {
      count: this.items().length,
      total: this.meta().total,
    }),
  );

  readonly emptyTitle = computed(() =>
    this.i18n.translate('inventory.empty.title'),
  );

  readonly emptyMessage = computed(() =>
    this.hasActiveFilters()
      ? this.i18n.translate('inventory.empty.filtered')
      : this.i18n.translate('inventory.empty.none'),
  );

  private requestSequence = 0;

  constructor() {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed())
      .subscribe((params) => {
        const filters = parseFilters(params);
        this.filters.set(filters);
        this.patchForm(filters);
        this.load(filters);
      });

    this.loadFilterOptions();
  }

  applyFilters(): void {
    const value = this.form.getRawValue();
    const sort: ExtinguisherSort = isExtinguisherSort(value.sort)
      ? value.sort
      : 'assetCode';
    const logisticsStatus: LogisticsStatus | '' = isLogisticsStatus(
      value.logisticsStatus,
    )
      ? value.logisticsStatus
      : '';
    const technicalCondition: TechnicalCondition | '' = isTechnicalCondition(
      value.technicalCondition,
    )
      ? value.technicalCondition
      : '';

    this.navigateTo({
      ...this.filters(),
      q: value.q.trim(),
      typeId: value.typeId,
      locationId: value.locationId,
      logisticsStatus,
      technicalCondition,
      includeRetired: value.includeRetired,
      sort,
      page: 1,
    });
  }

  clearFilters(): void {
    this.form.reset({
      q: '',
      typeId: '',
      locationId: '',
      logisticsStatus: '',
      technicalCondition: '',
      includeRetired: false,
      sort: 'assetCode',
    });
    this.navigateTo(defaultExtinguisherFilters());
  }

  changePage(page: number): void {
    this.navigateTo({ ...this.filters(), page });
  }

  retry(): void {
    this.load(this.filters());
  }

  retryFilterOptions(): void {
    this.loadFilterOptions();
  }

  logisticsKey(status: LogisticsStatus): TranslationKey {
    return LOGISTICS_LABEL_KEYS[status];
  }

  conditionKey(condition: TechnicalCondition): TranslationKey {
    return CONDITION_LABEL_KEYS[condition];
  }

  readonly logisticsTone = logisticsTone;
  readonly conditionTone = conditionTone;

  locationLabel(item: ExtinguisherSummary): string {
    if (item.currentLocation !== null) {
      return `${item.currentLocation.name} (${item.currentLocation.code})`;
    }
    if (item.currentExternalParty !== null) {
      return `${item.currentExternalParty.name} (${item.currentExternalParty.code})`;
    }
    return '—';
  }

  private navigateTo(filters: ExtinguisherFilters): void {
    const nextParams = toQueryParams(filters);
    if (queryKey(nextParams) === queryKey(toQueryParams(this.filters()))) {
      this.load(filters);
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: nextParams,
    });
  }

  private load(filters: ExtinguisherFilters): void {
    const sequence = ++this.requestSequence;
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api
      .list(filters, filters.locationId !== '')
      .subscribe({
        next: (response) => {
          if (sequence !== this.requestSequence) {
            return;
          }
          this.items.set(response.data);
          this.meta.set(response.meta);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          if (sequence !== this.requestSequence) {
            return;
          }
          this.items.set([]);
          this.errorMessage.set(
            error instanceof ApiClientError
              ? this.i18n.translateError(error)
              : this.i18n.translate('errors.generic'),
          );
          this.loading.set(false);
        },
      });
  }

  private loadFilterOptions(): void {
    this.filterOptionsError.set(null);

    if (this.canReadCatalogs()) {
      this.api.types().subscribe({
        next: (response) => {
          this.types.set(
            response.data.map((type) => ({
              id: type.id,
              code: type.code,
              name: type.name,
            })),
          );
        },
        error: (error: unknown) => this.setFilterOptionsError(error),
      });
    }

    if (this.canReadLocations()) {
      this.api.locations().subscribe({
        next: (response) => this.locations.set(response.data),
        error: (error: unknown) => this.setFilterOptionsError(error),
      });
    }
  }

  private setFilterOptionsError(error: unknown): void {
    this.filterOptionsError.set(
      error instanceof ApiClientError
        ? this.i18n.translateError(error)
        : this.i18n.translate('errors.generic'),
    );
  }

  private patchForm(filters: ExtinguisherFilters): void {
    this.form.setValue(
      {
        q: filters.q,
        typeId: filters.typeId,
        locationId: filters.locationId,
        logisticsStatus: filters.logisticsStatus,
        technicalCondition: filters.technicalCondition,
        includeRetired: filters.includeRetired,
        sort: filters.sort,
      },
      { emitEvent: false },
    );
  }
}
