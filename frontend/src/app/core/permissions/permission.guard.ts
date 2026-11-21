import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermissionService } from './permission.service';

/**
 * Comprueba `data.permission` (texto o lista) y `data.permissionMode`.
 * Es una ayuda de navegación; el backend sigue validando cada petición.
 */
export const permissionGuard: CanActivateFn = (route) => {
  const required = route.data['permission'] as
    | string
    | readonly string[]
    | undefined;

  if (required === undefined) {
    return true;
  }

  const mode = (route.data['permissionMode'] as 'any' | 'all' | undefined) ?? 'any';
  const permissions = inject(PermissionService);

  return permissions.isAllowed(required, mode)
    ? true
    : inject(Router).createUrlTree(['/app/sin-permiso']);
};
