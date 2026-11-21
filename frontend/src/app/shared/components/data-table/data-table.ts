import { NgTemplateOutlet } from '@angular/common';
import { Component, TemplateRef, input } from '@angular/core';
import { TPipe } from '../../../core/i18n/t.pipe';

export interface DataTableColumn {
  key: string;
  header: string;
  align?: 'start' | 'end';
}

/**
 * Tabla mínima reutilizable. Las filas se dibujan con una plantilla del
 * consumidor, de modo que cada módulo controla su contenido y sus permisos.
 *
 * ```html
 * <app-data-table [columns]="columns" [rows]="rows" [rowTemplate]="row" />
 * <ng-template #row let-item>
 *   <tr><td>{{ item.assetCode }}</td></tr>
 * </ng-template>
 * ```
 */
@Component({
  selector: 'app-data-table',
  imports: [NgTemplateOutlet, TPipe],
  template: `
    <div class="table-wrapper">
      <table>
        <caption class="visually-hidden">{{ caption() }}</caption>
        <thead>
          <tr>
            @for (column of columns(); track column.key) {
              <th
                scope="col"
                [class.table__cell--end]="column.align === 'end'"
              >
                {{ column.header }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track $index) {
            <ng-container
              *ngTemplateOutlet="
                rowTemplate();
                context: { $implicit: row, index: $index }
              "
            />
          } @empty {
            <tr>
              <td class="table__empty" [attr.colspan]="columns().length">
                {{ 'table.empty' | t }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--site-border);
      border-radius: var(--site-radius);
      background: var(--site-surface);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9375rem;
    }

    th,
    td {
      padding: 0.65rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--site-border);
      vertical-align: top;
    }

    th {
      background: var(--site-bg);
      font-weight: 600;
      white-space: nowrap;
    }

    tbody tr:last-child td {
      border-bottom: none;
    }

    .table__cell--end {
      text-align: right;
    }

    .table__empty {
      padding: 1.5rem 0.75rem;
      text-align: center;
      color: var(--site-muted);
    }
  `,
})
export class DataTableComponent {
  readonly caption = input.required<string>();
  readonly columns = input.required<readonly DataTableColumn[]>();
  readonly rows = input.required<readonly unknown[]>();
  readonly rowTemplate = input.required<TemplateRef<unknown>>();
}
