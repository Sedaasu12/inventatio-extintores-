import {
  Component,
  ElementRef,
  OnDestroy,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { ApiClientError, ERROR_CODES } from '../../../core/api/api-error';
import { TranslationKey } from '../../../core/i18n/es-PE';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import {
  QR_SCANNER_PORT,
  QrScannerError,
} from '../../../core/qr/qr-scanner.port';
import { ExtinguishersApi } from '../../extinguishers/extinguishers.api';

type CameraState =
  | 'idle'
  | 'requesting'
  | 'scanning'
  | 'denied'
  | 'unavailable'
  | 'error';

const CAMERA_HINTS: Record<CameraState, TranslationKey> = {
  idle: 'scan.camera.idle',
  requesting: 'scan.camera.requesting',
  scanning: 'scan.camera.scanning',
  denied: 'scan.camera.denied',
  unavailable: 'scan.camera.unavailable',
  error: 'scan.camera.error',
};

/**
 * Escaneo por cámara, lector USB 2D (modo teclado) y entrada manual. Escanear
 * un QR solo identifica el activo: la API vuelve a exigir sesión y permiso.
 */
@Component({
  selector: 'app-scan-page',
  imports: [ReactiveFormsModule, TPipe],
  templateUrl: './scan-page.html',
  styleUrl: './scan-page.scss',
})
export class ScanPage implements OnDestroy {
  private readonly api = inject(ExtinguishersApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly scanner = inject(QR_SCANNER_PORT);

  private readonly video =
    viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly manualInput =
    viewChild<ElementRef<HTMLInputElement>>('manualInput');

  readonly form = this.formBuilder.nonNullable.group({
    assetCode: ['', [Validators.required, Validators.maxLength(20)]],
  });

  readonly cameraState = signal<CameraState>('idle');
  readonly resolving = signal(false);
  readonly submitted = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly cameraHintKey = computed<TranslationKey>(
    () => CAMERA_HINTS[this.cameraState()],
  );
  readonly cameraWarning = computed(() => {
    const state = this.cameraState();
    return state === 'denied' || state === 'unavailable' || state === 'error';
  });

  constructor() {
    this.scanner.results$
      .pipe(takeUntilDestroyed())
      .subscribe((code) => this.resolve(code));
  }

  ngOnDestroy(): void {
    this.scanner.stop();
  }

  async startCamera(): Promise<void> {
    const state = this.cameraState();
    if (state === 'requesting' || state === 'scanning') {
      return;
    }

    this.errorMessage.set(null);
    this.cameraState.set('requesting');

    try {
      await this.scanner.start(this.video().nativeElement);
      this.cameraState.set('scanning');
    } catch (error: unknown) {
      this.cameraState.set(
        error instanceof QrScannerError ? error.reason : 'error',
      );
    }
  }

  stopCamera(): void {
    this.scanner.stop();
    this.cameraState.set('idle');
  }

  submitManual(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.resolve(this.form.controls.assetCode.value);
  }

  resetScan(): void {
    this.errorMessage.set(null);
    this.submitted.set(false);
    this.form.reset();
    this.cameraState.set('idle');
    this.manualInput()?.nativeElement.focus();
  }

  showError(): boolean {
    const control = this.form.controls.assetCode;
    return control.invalid && (control.touched || this.submitted());
  }

  private resolve(rawCode: string): void {
    const code = rawCode.trim().toUpperCase();
    if (code === '' || this.resolving()) {
      return;
    }

    this.stopCamera();
    this.errorMessage.set(null);
    this.resolving.set(true);

    this.api.getByCode(code).subscribe({
      next: (detail) => {
        this.resolving.set(false);
        void this.router.navigate(['/app/extintores', detail.id]);
      },
      error: (error: unknown) => {
        this.resolving.set(false);
        this.form.controls.assetCode.setValue(code);
        this.errorMessage.set(this.messageFor(error, code));
      },
    });
  }

  private messageFor(error: unknown, code: string): string {
    if (!(error instanceof ApiClientError)) {
      return this.i18n.translate('errors.generic');
    }
    if (
      error.code === ERROR_CODES.NOT_FOUND ||
      error.code === 'ASSET_NOT_FOUND'
    ) {
      return this.i18n.translate('scan.notFound', { code });
    }
    return this.i18n.translateError(error);
  }
}
