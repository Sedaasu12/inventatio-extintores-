import {
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/**
 * Confirmación modal accesible basada en `<dialog>`.
 *
 * El componente no decide nada: emite `confirmed` o `cancelled` y el padre
 * cambia `open`. Se usa antes de bajas, ajustes y otras acciones sensibles.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [TPipe],
  template: `
    <dialog
      #dialog
      class="dialog"
      [attr.aria-label]="title()"
      (cancel)="onCancel($event)"
    >
      <div class="dialog__panel">
        <h2 class="dialog__title">{{ title() }}</h2>
        <p class="dialog__message">{{ message() }}</p>
        <div class="dialog__actions">
          <button
            type="button"
            class="site-button site-button--secondary"
            (click)="cancelled.emit()"
          >
            {{ 'dialog.cancel' | t }}
          </button>
          <button type="button" class="site-button" (click)="confirmed.emit()">
            {{ confirmLabel() ?? ('dialog.confirm' | t) }}
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .dialog {
      width: min(28rem, calc(100vw - 2rem));
      padding: 0;
      border: none;
      border-radius: var(--site-radius);
      box-shadow: var(--site-shadow);
      color: var(--site-text);
    }

    .dialog::backdrop {
      background: rgba(16, 24, 40, 0.45);
    }

    .dialog__panel {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.25rem;
    }

    .dialog__title {
      font-size: 1.125rem;
    }

    .dialog__message {
      color: var(--site-muted);
    }

    .dialog__actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
  `,
})
export class ConfirmDialogComponent {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input<string | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly dialogRef =
    viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const dialog = this.dialogRef().nativeElement;
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  onCancel(event: Event): void {
    // El padre decide cuándo cerrar; así el estado del signal y el DOM no
    // se desincronizan.
    event.preventDefault();
    this.cancelled.emit();
  }
}
