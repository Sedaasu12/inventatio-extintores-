import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

/**
 * Consulta de permisos efectivos. Solo decide qué mostrar; la autorización
 * real la aplica el backend en cada petición.
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly auth = inject(AuthService);

  private readonly granted = computed(
    () => new Set(this.auth.user()?.permissions ?? []),
  );

  has(permission: string): boolean {
    return this.granted().has(permission);
  }

  hasAny(permissions: readonly string[]): boolean {
    return permissions.some((permission) => this.has(permission));
  }

  hasAll(permissions: readonly string[]): boolean {
    return permissions.every((permission) => this.has(permission));
  }

  isAllowed(
    permissions: string | readonly string[],
    mode: 'any' | 'all' = 'any',
  ): boolean {
    if (typeof permissions === 'string') {
      return this.has(permissions);
    }
    return mode === 'all'
      ? this.hasAll(permissions)
      : this.hasAny(permissions);
  }
}
