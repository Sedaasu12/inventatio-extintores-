import { Component, input } from '@angular/core';

export type StatusTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

/** Etiqueta compacta para estados logísticos, condiciones y resultados. */
@Component({
  selector: 'app-status-chip',
  host: { class: 'status-chip' },
  template: `<span class="status-chip__badge" [class]="'status-chip__badge--' + tone()">{{ label() }}</span>`,
  styles: `
    :host {
      display: inline-block;
    }

    .status-chip__badge {
      display: inline-flex;
      align-items: center;
      padding: 0.15rem 0.55rem;
      border-radius: 999px;
      border: 1px solid var(--site-border);
      background: var(--site-bg);
      color: var(--site-text);
      font-size: 0.8125rem;
      font-weight: 600;
      white-space: nowrap;
    }

    .status-chip__badge--info {
      border-color: #9fc4e8;
      background: var(--site-primary-soft);
      color: #0a3f75;
    }

    .status-chip__badge--success {
      border-color: #a7d5b6;
      background: var(--site-success-soft);
      color: #14532d;
    }

    .status-chip__badge--warning {
      border-color: #e2c184;
      background: var(--site-warning-soft);
      color: #5f3a00;
    }

    .status-chip__badge--danger {
      border-color: #e7b1ac;
      background: var(--site-danger-soft);
      color: #7c1d16;
    }
  `,
})
export class StatusChipComponent {
  readonly label = input.required<string>();
  readonly tone = input<StatusTone>('neutral');
}
