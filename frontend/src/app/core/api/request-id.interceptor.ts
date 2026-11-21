import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Propaga un identificador de correlación. El servidor lo devuelve en
 * `X-Request-Id` y los errores lo muestran como referencia para soporte.
 */
export const requestIdInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.headers.has('X-Request-Id')) {
    return next(request);
  }
  return next(
    request.clone({ setHeaders: { 'X-Request-Id': createRequestId() } }),
  );
};

function createRequestId(): string {
  const cryptoRef = globalThis.crypto;
  if (typeof cryptoRef?.randomUUID === 'function') {
    return cryptoRef.randomUUID();
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
