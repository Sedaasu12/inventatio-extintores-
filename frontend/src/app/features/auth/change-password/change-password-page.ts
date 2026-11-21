import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiClientError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

/** La nueva contraseña debe coincidir con su repetición. */
const passwordsMatch: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const newPassword = group.get('newPassword')?.value as string;
  const confirmPassword = group.get('confirmPassword')?.value as string;
  return newPassword === confirmPassword ? null : { mismatch: true };
};

/** La nueva contraseña debe ser distinta de la actual. */
const newDiffersFromCurrent: ValidatorFn = (
  group: AbstractControl,
): ValidationErrors | null => {
  const current = group.get('currentPassword')?.value as string;
  const next = group.get('newPassword')?.value as string;
  return current !== '' && current === next ? { sameAsCurrent: true } : null;
};

@Component({
  selector: 'app-change-password-page',
  imports: [ReactiveFormsModule, RouterLink, TPipe],
  templateUrl: './change-password-page.html',
  styleUrl: './change-password-page.scss',
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly mustChangePassword = this.auth.mustChangePassword;
  readonly saved = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly showPasswords = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly errorReference = signal<string | null>(null);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', [Validators.required, Validators.maxLength(128)]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.maxLength(128),
        ],
      ],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: [passwordsMatch, newDiffersFromCurrent] },
  );

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  showGroupError(name: string): boolean {
    return (
      this.form.hasError(name) &&
      (this.form.controls.confirmPassword.touched || this.submitted())
    );
  }

  togglePasswords(): void {
    this.showPasswords.update((visible) => !visible);
  }

  submit(): void {
    if (this.submitting()) {
      return;
    }

    this.submitted.set(true);
    this.errorMessage.set(null);
    this.errorReference.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth.changePassword({ currentPassword, newPassword }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.set(true);
        this.form.reset();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
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

    if (error.status === 429) {
      const seconds = error.retryAfterSeconds ?? 60;
      this.errorMessage.set(
        this.i18n.translate('auth.errors.rateLimited', { seconds }),
      );
      return;
    }

    this.errorMessage.set(this.i18n.translateError(error));
  }
}
