import { Component, input } from '@angular/core';

/** Mensaje para listas o secciones sin datos, con espacio para acciones. */
@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state" role="status">
      <p class="empty-state__title">{{ title() }}</p>
      @if (message() !== '') {
        <p class="empty-state__message">{{ message() }}</p>
      }
      <div class="empty-state__actions">
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 2rem 1rem;
      border: 1px dashed var(--site-border);
      border-radius: var(--site-radius);
      background: var(--site-surface);
      text-align: center;
    }

    .empty-state__title {
      font-weight: 600;
    }

    .empty-state__message {
      max-width: 46ch;
      color: var(--site-muted);
    }

    .empty-state__actions:not(:empty) {
      margin-top: 0.5rem;
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input('');
}
