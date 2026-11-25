import {
  Component,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiClientError } from '../../../core/api/api-error';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/t.pipe';
import { ExtinguishersApi } from '../extinguishers.api';
import { ExtinguisherDetail } from '../extinguisher.models';

/**
 * Etiqueta imprimible. Solo muestra el código estable y el tipo; el QR se pide
 * como PNG a la API para que la etiqueta no incluya ubicación, fechas ni PII.
 */
@Component({
  selector: 'app-extinguisher-label-page',
  imports: [RouterLink, TPipe],
  templateUrl: './extinguisher-label-page.html',
  styleUrl: './extinguisher-label-page.scss',
})
export class ExtinguisherLabelPage implements OnDestroy {
  private readonly api = inject(ExtinguishersApi);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);

  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  private objectUrl: string | null = null;

  readonly detail = signal<ExtinguisherDetail | null>(null);
  readonly qrUrl = signal<string | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  print(): void {
    window.print();
  }

  retry(): void {
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
    this.revokeObjectUrl();

    forkJoin({
      detail: this.api.get(this.id),
      qr: this.api.qrImage(this.id),
    }).subscribe({
      next: ({ detail, qr }) => {
        this.objectUrl = URL.createObjectURL(qr);
        this.detail.set(detail);
        this.qrUrl.set(this.objectUrl);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.detail.set(null);
        this.qrUrl.set(null);
        this.errorMessage.set(
          error instanceof ApiClientError
            ? this.i18n.translateError(error)
            : this.i18n.translate('errors.generic'),
        );
        this.loading.set(false);
      },
    });
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl !== null) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
