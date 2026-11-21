import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/** Rutas que no llevan `Authorization`: usan o crean la cookie de refresh. */
const CREDENTIAL_PATHS = ['/auth/login', '/auth/refresh'];

/**
 * Añade el access token en memoria. Se resuelve en tiempo de petición para no
 * crear un ciclo de inyección con `HttpClient`.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (CREDENTIAL_PATHS.some((path) => request.url.includes(path))) {
    return next(request);
  }
  const token = inject(AuthService).accessToken();
  if (token === null) {
    return next(request);
  }
  return next(
    request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
