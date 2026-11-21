import { Component, computed, input, output } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

/** Paginación del servidor: no conoce datos, solo página, tamaño y total. */
@Component({
  selector: 'app-pagination',
  imports: [TPipe],
  template: `
    <nav class="pagination" [attr.aria-label]="'pagination.label' | t">
      <button
        type="button"
        class="site-button site-button--secondary"
        [disabled]="page() <= 1"
        (click)="goTo(page() - 1)"
      >
        {{ 'pagination.previous' | t }}
      </button>
      <span class="pagination__status" aria-live="polite">
        {{ 'pagination.status' | t: { page: page(), totalPages: totalPages() } }}
      </span>
      <button
        type="button"
        class="site-button site-button--secondary"
        [disabled]="page() >= totalPages()"
        (click)="goTo(page() + 1)"
      >
        {{ 'pagination.next' | t }}
      </button>
    </nav>
  `,
  styles: `
    .pagination {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 0.75rem 0;
    }

    .pagination__status {
      color: var(--site-muted);
      min-width: 10ch;
      text-align: center;
    }
  `,
})
export class PaginationComponent {
  readonly page = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly total = input.required<number>();
  readonly pageChange = output<number>();

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.total() / Math.max(1, this.pageSize()))),
  );

  goTo(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages());
    if (target !== this.page()) {
      this.pageChange.emit(target);
    }
  }
}
