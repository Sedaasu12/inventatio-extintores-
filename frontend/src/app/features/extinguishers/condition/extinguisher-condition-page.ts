import { Component, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiClientError, ERROR_CODES } from '../../../core/api/api-error';
import { TranslationKey } from '../../../core/i18n/es-PE';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { StatusChipComponent } from '../../../shared/components/status-chip/status-chip';
import { ExtinguishersApi } from '../extinguishers.api';
import { conditionTone } from '../extinguisher-status';
import {
  CONDITION_LABEL_KEYS,
  ChangeConditionPayload,
  ExtinguisherDetail,
  TECHNICAL_CONDITIONS,
  TechnicalCondition,
} from '../extinguisher.models';

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Cambio de condición técnica. Solo SEGURIDAD/ADMIN tienen el permiso; la
 * regla que impide NO_OPERATIVO en un activo asignado se valida aquí y en el
 * backend. El cambio siempre exige motivo y queda auditado.
 */
@Component({
  selector: 'app-extinguisher-condition-page',
  imports: [ReactiveFormsModule, RouterLink, TPipe, StatusChipComponent],
  templateUrl: './extinguisher-condition-page.html',
  styleUrl: './extinguisher-condition-page.scss',
})
export class ExtinguisherConditionPage {
  private readonly api = inject(ExtinguishersApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(FormBuilder);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly detail = signal<ExtinguisherDetail | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly errorReference = signal<string | null>(null);
  readonly showReload = signal(false);

  readonly conditionOptions = TECHNICAL_CONDITIONS;
  readonly conditionTone = conditionTone;

  readonly form = this.formBuilder.nonNullable.group({
    condition: ['' as TechnicalCondition | '', Validators.required],
    reason: [
      '',
      [
        Validators.required,
        Validators.minLength(5),
        Validators.maxLength(500),
      ],
    ],
    documentRef: ['', Validators.maxLength(100)],
  });

  constructor() {
    this.load();
  }

  conditionKey(condition: TechnicalCondition): TranslationKey {
    return CONDITION_LABEL_KEYS[condition];
  }

  isNotAssignable(): boolean {
    return (
      this.detail()?.logisticsStatus === 'ASIGNADO' &&
      this.form.controls.condition.value === 'NO_OPERATIVO'
    );
  }

  showError(name: 'condition' | 'reason' | 'documentRef'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.touched || this.submitted());
  }

  errorKey(name: 'condition' | 'reason' | 'documentRef'): TranslationKey {
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
    return 'common.invalid';
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
    if (this.isNotAssignable()) {
      return;
    }

    const detail = this.detail();
    if (detail === null) {
      return;
    }

    const value = this.form.getRawValue();
    const payload: ChangeConditionPayload = {
      condition: value.condition as TechnicalCondition,
      reason: value.reason.trim(),
      documentRef: optionalText(value.documentRef),
      rowVersion: detail.rowVersion,
    };

    this.submitting.set(true);
    this.api.changeCondition(detail.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigate(['/app/extintores', detail.id], {
          queryParams: { conditionUpdated: 'true' },
        });
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        this.presentError(error);
      },
    });
  }

  retry(): void {
    this.load();
  }

  reload(): void {
    this.load();
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
    this.errorReference.set(null);
    this.showReload.set(false);

    this.api.get(this.id).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.detail.set(null);
        this.loading.set(false);
        this.presentError(error);
      },
    });
  }

  private presentError(error: unknown): void {
    if (!(error instanceof ApiClientError)) {
      this.errorMessage.set(this.i18n.translate('errors.generic'));
      return;
    }

    this.errorReference.set(error.requestId ?? null);
    this.errorMessage.set(this.i18n.translateError(error));
    this.showReload.set(
      error.status === 409 && error.code === ERROR_CODES.CONCURRENCY,
    );
  }
}
