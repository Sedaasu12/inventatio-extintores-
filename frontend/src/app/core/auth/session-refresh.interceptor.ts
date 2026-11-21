import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Evita reintentar indefinidamente la misma petición. */
export const REFRESH_RETRIED = new HttpContextToken<boolean>(() => false);

/** Un 401 en estas rutas no se renueva: son el propio ciclo de sesión. */
const SESSION_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'];

/**
 * Ante un 401 renueva la sesión una sola vez y reintenta la petición original.
 * Varias peticiones simultáneas comparten el mismo refresh (single-flight).
 */
export const sessionRefreshInterceptor: HttpInterceptorFn = (request, next) => {
  const injector = inject(Injector);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        request.context.get(REFRESH_RETRIED) ||
        SESSION_PATHS.some((path) => request.url.includes(path))
      ) {
        return throwError(() => error);
      }

      const auth = injector.get(AuthService);
      return auth.refreshSession().pipe(
        catchError(() => throwError(() => error)),
        switchMap((session) =>
          next(
            request.clone({
              context: request.context.set(REFRESH_RETRIED, true),
              setHeaders: {
                Authorization: `Bearer ${session.accessToken}`,
              },
            }),
          ),
        ),
      );
    }),
  );
};
