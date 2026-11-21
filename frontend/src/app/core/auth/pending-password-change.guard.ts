import { inject } from '@angular/core';
import { CanActivateChildFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Ruta permitida mientras el cambio de contraseña está pendiente. */
const CHANGE_PASSWORD_URL = '/app/cambiar-contrasena';

/**
 * Mientras `mustChangePassword` siga activo solo se permite la pantalla de
 * cambio. Se aplica a los hijos del armazón, de modo que también cubre la
 * navegación entre secciones sin volver a evaluar el guard del padre.
 */
export const pendingPasswordChangeGuard: CanActivateChildFn = (
  _route,
  state,
) => {
  const auth = inject(AuthService);
  if (!auth.mustChangePassword() || state.url.startsWith(CHANGE_PASSWORD_URL)) {
    return true;
  }
  return inject(Router).createUrlTree([CHANGE_PASSWORD_URL]);
};
