import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiClientError, ERROR_CODES } from '../../../core/api/api-error';
import { TranslationKey } from '../../../core/i18n/es-PE';
import { APP_TIME_ZONE } from '../../../core/i18n/locale';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ExtinguishersApi } from '../extinguishers.api';
import {
  CAPACITY_UNITS,
  CAPACITY_UNIT_LABEL_KEYS,
  CapacityUnit,
  CONDITION_LABEL_KEYS,
  CreateExtinguisherPayload,
  ENTRY_SOURCES,
  ENTRY_SOURCE_LABEL_KEYS,
  EntrySource,
  ExtinguisherDetail,
  ExtinguisherTypeOption,
  LocationNode,
  TECHNICAL_CONDITIONS,
  TechnicalCondition,
  UpdateExtinguisherPayload,
} from '../extinguisher.models';

type FormMode = 'create' | 'edit';

type FieldName =
  | 'typeId'
  | 'capacityValue'
  | 'capacityUnit'
  | 'serialNumber'
  | 'brand'
  | 'model'
  | 'manufactureDate'
  | 'acquiredAt'
  | 'commissionedAt'
  | 'manufacturerExpiryDate'
  | 'initialLocationId'
  | 'entrySource'
  | 'initialReason'
  | 'receivedBy'
  | 'documentRef'
  | 'technicalCondition'
  | 'notes';

interface LocationGroup {
  sede: LocationNode;
  options: LocationNode[];
}

const CAPACITY_DECIMALS = /^\d+(\.\d{1,2})?$/;

/** Hoy en la zona de presentación, con el mismo criterio que el backend. */
function todayInLima(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
  }).format(new Date());
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const maxTwoDecimals: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value;
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  return CAPACITY_DECIMALS.test(value) ? null : { decimals: true };
};

/**
 * Mismas reglas documentadas del backend: fabricación no futura, adquisición
 * no anterior a fabricación, puesta en servicio no anterior a adquisición y
 * vencimiento documentado no anterior a fabricación.
 */
const dateOrder: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const manufacture = (group.get('manufactureDate')?.value ?? '') as string;
  const acquired = (group.get('acquiredAt')?.value ?? '') as string;
  const commissioned = (group.get('commissionedAt')?.value ?? '') as string;
  const expiry = (group.get('manufacturerExpiryDate')?.value ?? '') as string;
  const today = todayInLima();

  if (manufacture !== '' && manufacture > today) {
    return { manufactureFuture: true };
  }
  if (manufacture !== '' && acquired !== '' && acquired < manufacture) {
    return { acquiredBeforeManufacture: true };
  }
  const acquisitionFloor = acquired !== '' ? acquired : manufacture;
  if (
    acquisitionFloor !== '' &&
    commissioned !== '' &&
    commissioned < acquisitionFloor
  ) {
    return { commissionedBeforeAcquisition: true };
  }
  if (manufacture !== '' && expiry !== '' && expiry < manufacture) {
    return { expiryBeforeManufacture: true };
  }
  return null;
};

/**
 * Un solo formulario para alta y edición. En edición se deshabilitan los
 * campos que solo existen en el ingreso inicial: ubicación, origen, receptor y
 * condición tienen operaciones propias y auditadas.
 */
@Component({
  selector: 'app-extinguisher-form-page',
  imports: [ReactiveFormsModule, RouterLink, TPipe],
  templateUrl: './extinguisher-form-page.html',
  styleUrl: './extinguisher-form-page.scss',
})
export class ExtinguisherFormPage {
  private readonly api = inject(ExtinguishersApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  readonly mode: FormMode =
    this.route.snapshot.data['mode'] === 'edit' ? 'edit' : 'create';
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly form = this.formBuilder.nonNullable.group(
    {
      typeId: ['', Validators.required],
      capacityValue: [
        '',
        [
          Validators.required,
          Validators.min(0.01),
          Validators.max(99999999.99),
          maxTwoDecimals,
        ],
      ],
      capacityUnit: ['' as CapacityUnit | '', Validators.required],
      serialNumber: ['', Validators.maxLength(100)],
      brand: ['', Validators.maxLength(100)],
      model: ['', Validators.maxLength(100)],
      manufactureDate: [''],
      acquiredAt: [''],
      commissionedAt: [''],
      manufacturerExpiryDate: [''],
      initialLocationId: ['', Validators.required],
      entrySource: ['' as EntrySource | '', Validators.required],
      initialReason: [
        '',
        [
          Validators.required,
          Validators.minLength(5),
          Validators.maxLength(500),
        ],
      ],
      receivedBy: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(150),
        ],
      ],
      documentRef: ['', [Validators.required, Validators.maxLength(100)]],
      technicalCondition: ['' as TechnicalCondition | '', Validators.required],
      notes: ['', Validators.maxLength(2000)],
    },
    { validators: [dateOrder] },
  );

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly errorReference = signal<string | null>(null);
  readonly showReload = signal(false);

  readonly types = signal<ExtinguisherTypeOption[]>([]);
  readonly locations = signal<LocationNode[]>([]);
  readonly detail = signal<ExtinguisherDetail | null>(null);
  readonly selectedType = signal<ExtinguisherTypeOption | null>(null);

  readonly titleKey: TranslationKey =
    this.mode === 'edit'
      ? 'extinguisherForm.editTitle'
      : 'extinguisherForm.createTitle';
  readonly subtitleKey: TranslationKey =
    this.mode === 'edit'
      ? 'extinguisherForm.editSubtitle'
      : 'extinguisherForm.createSubtitle';
  readonly submitKey: TranslationKey =
    this.mode === 'edit'
      ? 'extinguisherForm.submitEdit'
      : 'extinguisherForm.submitCreate';
  readonly backKey: TranslationKey =
    this.mode === 'edit'
      ? 'extinguisherForm.backToDetail'
      : 'extinguisherDetail.back';

  readonly typeOptions = computed<ExtinguisherTypeOption[]>(() => {
    const options = [...this.types()];
    const detail = this.detail();
    if (
      detail !== null &&
      !options.some((type) => type.id === detail.type.id)
    ) {
      options.push({
        id: detail.type.id,
        code: detail.type.code,
        name: detail.type.name,
        nominalCapacity: detail.type.nominalCapacity,
        capacityUnit: detail.type.capacityUnit,
        usefulLifeYears: detail.type.usefulLifeYears,
        active: false,
      });
    }
    return options;
  });

  readonly locationGroups = computed<LocationGroup[]>(() =>
    this.locations()
      .map((sede) => ({
        sede,
        options: sede.children.filter(
          (child) => child.type === 'ALMACEN' || child.type === 'AREA',
        ),
      }))
      .filter((group) => group.options.length > 0),
  );

  readonly capacityUnitOptions = CAPACITY_UNITS;
  readonly entrySourceOptions = ENTRY_SOURCES;
  readonly conditionOptions = TECHNICAL_CONDITIONS;

  readonly cancelLink = computed<string[]>(() =>
    this.mode === 'edit' && this.id !== ''
      ? ['/app/extintores', this.id]
      : ['/app/extintores'],
  );

  private idempotencyKey: string | null = null;
  private lastFingerprint: string | null = null;

  constructor() {
    if (this.mode === 'edit') {
      this.configureEditMode();
      this.loadEditData();
    } else {
      this.loadCreateCatalogs();
    }
  }

  capacityUnitKey(unit: CapacityUnit): TranslationKey {
    return CAPACITY_UNIT_LABEL_KEYS[unit];
  }

  typeLabel(type: ExtinguisherTypeOption): string {
    const base = `${type.name} (${type.code})`;
    return type.active
      ? base
      : `${base} · ${this.i18n.translate('extinguisherForm.typeInactive')}`;
  }

  entrySourceKey(source: EntrySource): TranslationKey {
    return ENTRY_SOURCE_LABEL_KEYS[source];
  }

  conditionKey(condition: TechnicalCondition): TranslationKey {
    return CONDITION_LABEL_KEYS[condition];
  }

  onTypeChange(event: Event): void {
    const typeId = (event.target as HTMLSelectElement).value;
    const type = this.typeOptions().find((option) => option.id === typeId);
    if (type === undefined) {
      this.selectedType.set(null);
      return;
    }
    const previous = this.selectedType();
    const capacityValue = this.form.controls.capacityValue;
    const capacityUnit = this.form.controls.capacityUnit;
    const keepValue =
      previous !== null &&
      capacityValue.value !== '' &&
      capacityValue.value !== previous.nominalCapacity;
    const keepUnit =
      previous !== null && capacityUnit.value !== previous.capacityUnit;

    if (!keepValue) {
      capacityValue.setValue(type.nominalCapacity);
    }
    if (!keepUnit) {
      capacityUnit.setValue(type.capacityUnit);
    }
    this.selectedType.set(type);
  }

  /** Regla D-26b replicada en la interfaz; el backend la vuelve a validar. */
  isCreateConditionNotAssignable(): boolean {
    if (this.mode !== 'create') {
      return false;
    }
    const locationId = this.form.controls.initialLocationId.value;
    const location = this.locations()
      .flatMap((sede) => sede.children)
      .find((child) => child.id === locationId);
    return (
      location?.type === 'AREA' &&
      this.form.controls.technicalCondition.value === 'NO_OPERATIVO'
    );
  }

  showError(name: FieldName): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  errorKey(name: FieldName): TranslationKey {
    const errors = this.form.controls[name].errors;
    if (errors === null) {
      return 'common.invalid';
    }
    if (errors['required']) {
      return 'common.required';
    }
    if (errors['maxlength']) {
      return 'common.tooLong';
    }
    if (errors['minlength']) {
      return 'extinguisherForm.errors.tooShort';
    }
    if (errors['min']) {
      return 'extinguisherForm.errors.positive';
    }
    if (errors['max']) {
      return 'extinguisherForm.errors.tooLarge';
    }
    if (errors['decimals']) {
      return 'extinguisherForm.errors.decimals';
    }
    return 'common.invalid';
  }

  showDateError(): boolean {
    if (this.dateErrorKey() === null) {
      return false;
    }
    const controls = [
      this.form.controls.manufactureDate,
      this.form.controls.acquiredAt,
      this.form.controls.commissionedAt,
      this.form.controls.manufacturerExpiryDate,
    ];
    return this.submitted() || controls.some((control) => control.touched);
  }

  dateErrorKey(): TranslationKey | null {
    const errors = this.form.errors;
    if (errors === null) {
      return null;
    }
    if (errors['manufactureFuture']) {
      return 'extinguisherForm.errors.manufactureFuture';
    }
    if (errors['acquiredBeforeManufacture']) {
      return 'extinguisherForm.errors.acquiredBeforeManufacture';
    }
    if (errors['commissionedBeforeAcquisition']) {
      return 'extinguisherForm.errors.commissionedBeforeAcquisition';
    }
    if (errors['expiryBeforeManufacture']) {
      return 'extinguisherForm.errors.expiryBeforeManufacture';
    }
    return null;
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }

    this.submitted.set(true);
    this.errorMessage.set(null);
    this.errorReference.set(null);
    this.showReload.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.isCreateConditionNotAssignable()) {
      return;
    }

    if (this.mode === 'edit') {
      this.submitEdit();
    } else {
      this.submitCreate();
    }
  }

  retryLoad(): void {
    if (this.mode === 'edit') {
      this.loadEditData();
    } else {
      this.loadCreateCatalogs();
    }
  }

  reload(): void {
    if (this.mode === 'edit') {
      this.loadEditData();
    }
  }

  private configureEditMode(): void {
    const createOnly: FieldName[] = [
      'initialLocationId',
      'entrySource',
      'initialReason',
      'receivedBy',
      'documentRef',
      'technicalCondition',
    ];
    for (const name of createOnly) {
      const control = this.form.controls[name];
      control.clearValidators();
      control.updateValueAndValidity();
      control.disable();
    }
  }

  private loadCreateCatalogs(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      types: this.api.types(),
      locations: this.api.locations(),
    }).subscribe({
      next: ({ types, locations }) => {
        this.types.set(types.data);
        this.locations.set(locations.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.presentError(error);
      },
    });
  }

  private loadEditData(): void {
    if (this.id === '') {
      this.loading.set(false);
      this.errorMessage.set(
        this.i18n.translate('errors.codes.ASSET_NOT_FOUND'),
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);
    this.errorReference.set(null);
    this.showReload.set(false);

    forkJoin({
      types: this.api.types(),
      detail: this.api.get(this.id),
    }).subscribe({
      next: ({ types, detail }) => {
        this.types.set(types.data);
        this.detail.set(detail);
        this.patchForm(detail);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.presentError(error);
      },
    });
  }

  private patchForm(detail: ExtinguisherDetail): void {
    this.selectedType.set({
      id: detail.type.id,
      code: detail.type.code,
      name: detail.type.name,
      nominalCapacity: detail.type.nominalCapacity,
      capacityUnit: detail.type.capacityUnit,
      usefulLifeYears: detail.type.usefulLifeYears,
      active: true,
    });

    this.form.patchValue({
      typeId: detail.type.id,
      capacityValue: detail.capacityValue,
      capacityUnit: detail.capacityUnit,
      serialNumber: detail.serialNumber ?? '',
      brand: detail.brand ?? '',
      model: detail.model ?? '',
      manufactureDate: detail.manufactureDate ?? '',
      acquiredAt: detail.acquiredAt ?? '',
      commissionedAt: detail.commissionedAt ?? '',
      manufacturerExpiryDate: detail.manufacturerExpiryDate ?? '',
      notes: detail.notes ?? '',
    });
  }

  private submitCreate(): void {
    const payload = this.buildCreatePayload();
    const fingerprint = JSON.stringify(payload);

    if (fingerprint !== this.lastFingerprint || this.idempotencyKey === null) {
      this.lastFingerprint = fingerprint;
      this.idempotencyKey = newIdempotencyKey();
    }
    const key = this.idempotencyKey ?? newIdempotencyKey();
    this.idempotencyKey = key;

    this.submitting.set(true);
    this.api.create(payload, key).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.lastFingerprint = null;
        this.idempotencyKey = null;
        void this.router.navigate(['/app/extintores', response.id], {
          queryParams: { created: 'true' },
        });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.presentError(error);
      },
    });
  }

  private submitEdit(): void {
    const detail = this.detail();
    if (detail === null) {
      return;
    }

    const payload = this.buildUpdatePayload(detail.rowVersion);
    this.submitting.set(true);
    this.api.update(detail.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/app/extintores', detail.id], {
          queryParams: { updated: 'true' },
        });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.presentError(error);
      },
    });
  }

  private buildCreatePayload(): CreateExtinguisherPayload {
    const value = this.form.getRawValue();
    return {
      serialNumber: optionalText(value.serialNumber),
      typeId: value.typeId,
      brand: optionalText(value.brand),
      model: optionalText(value.model),
      capacityValue: Number(value.capacityValue),
      capacityUnit: value.capacityUnit as CapacityUnit,
      manufactureDate: optionalText(value.manufactureDate),
      acquiredAt: optionalText(value.acquiredAt),
      commissionedAt: optionalText(value.commissionedAt),
      manufacturerExpiryDate: optionalText(value.manufacturerExpiryDate),
      initialLocationId: value.initialLocationId,
      entrySource: value.entrySource as EntrySource,
      initialReason: value.initialReason.trim(),
      receivedBy: value.receivedBy.trim(),
      documentRef: value.documentRef.trim(),
      technicalCondition: value.technicalCondition as TechnicalCondition,
      notes: optionalText(value.notes),
    };
  }

  private buildUpdatePayload(rowVersion: number): UpdateExtinguisherPayload {
    const value = this.form.getRawValue();
    return {
      serialNumber: optionalText(value.serialNumber),
      typeId: value.typeId,
      brand: optionalText(value.brand),
      model: optionalText(value.model),
      capacityValue: Number(value.capacityValue),
      capacityUnit: value.capacityUnit as CapacityUnit,
      manufactureDate: optionalText(value.manufactureDate),
      acquiredAt: optionalText(value.acquiredAt),
      commissionedAt: optionalText(value.commissionedAt),
      manufacturerExpiryDate: optionalText(value.manufacturerExpiryDate),
      notes: optionalText(value.notes),
      rowVersion,
    };
  }

  private presentError(error: unknown): void {
    if (!(error instanceof ApiClientError)) {
      this.errorMessage.set(this.i18n.translate('errors.generic'));
      return;
    }

    this.errorReference.set(error.requestId ?? null);
    this.errorMessage.set(this.i18n.translateError(error));
    this.showReload.set(
      this.mode === 'edit' &&
        error.status === 409 &&
        error.code === ERROR_CODES.CONCURRENCY,
    );
  }
}
