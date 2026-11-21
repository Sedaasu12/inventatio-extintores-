import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiClientError } from '../../../core/api/api-error';
import { AuthService } from '../../../core/auth/auth.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';

export const DEFAULT_RETURN_URL = '/app/inicio';

function hasControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Solo se aceptan rutas internas. Evita redirecciones abiertas: nada de
 * `//otro.sitio`, esquemas `http:` ni barras invertidas.
 */
export function sanitizeReturnUrl(value: string | null): string {
  if (value === null) {
    return DEFAULT_RETURN_URL;
  }
  const candidate = value.trim();
  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    candidate.includes('://') ||
    hasControlCharacters(candidate) ||
    candidate.startsWith('/login')
  ) {
    return DEFAULT_RETURN_URL;
  }
  return candidate;
}

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule, TPipe],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: [
      '',
      [Validators.required, Validators.email, Validators.maxLength(254)],
    ],
    password: ['', [Validators.required, Validators.maxLength(128)]],
  });

  readonly showPassword = signal(false);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly errorReference = signal<string | null>(null);
  readonly sessionExpired =
    this.route.snapshot.queryParamMap.get('expired') === 'true';

  private readonly returnUrl = sanitizeReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl'),
  );

  showError(control: AbstractControl): boolean {
    return control.invalid && (control.touched || this.submitted());
  }

  togglePassword(): void {
    this.showPassword.update((visible) => !visible);
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

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);

    this.auth.login({ email: email.trim(), password }).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.returnUrl);
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

    if (error.status === 401) {
      this.errorMessage.set(this.i18n.translate('auth.errors.invalidCredentials'));
      return;
    }

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
