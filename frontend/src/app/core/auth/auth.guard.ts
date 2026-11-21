import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/**
 * Exige sesión activa y conserva la ruta solicitada para volver después del
 * login. El cambio de contraseña pendiente lo cubre
 * `pendingPasswordChangeGuard` sobre los hijos del armazón.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);

  if (auth.isAuthenticated()) {
    return true;
  }

  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
