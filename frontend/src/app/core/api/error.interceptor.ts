import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiClientError } from './api-error';

/**
 * Convierte cualquier fallo en `ApiClientError` para que la interfaz nunca
 * tenga que leer el cuerpo del error ni mostrar trazas.
 *
 * Va primero en la lista de interceptores para recibir el error ya procesado
 * por el interceptor de renovación de sesión.
 */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  return next(request).pipe(
    catchError((error: unknown) =>
      throwError(() =>
        error instanceof HttpErrorResponse
          ? ApiClientError.fromResponse(error)
          : ApiClientError.fromUnknown(error),
      ),
    ),
  );
};
