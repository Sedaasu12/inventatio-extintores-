import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { PermissionService } from './permission.service';

/**
 * Muestra el contenido solo si el usuario tiene el permiso indicado.
 *
 * ```html
 * <button *appHasPermission="'extinguishers.create'">Nuevo extintor</button>
 * <a *appHasPermission="['alerts.read', 'alerts.settings']; mode: 'all'">…</a>
 * ```
 *
 * Ocultar una acción no sustituye la autorización del backend.
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  readonly permission = input.required<string | readonly string[]>({
    alias: 'appHasPermission',
  });
  readonly mode = input<'any' | 'all'>('any', {
    alias: 'appHasPermissionMode',
  });

  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly container = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);
  private rendered = false;

  constructor() {
    effect(() => {
      const allowed = this.permissions.isAllowed(
        this.permission(),
        this.mode(),
      );
      if (allowed === this.rendered) {
        return;
      }
      this.rendered = allowed;
      this.container.clear();
      if (allowed) {
        this.container.createEmbeddedView(this.template);
      }
    });
  }
}
