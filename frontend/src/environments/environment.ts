/**
 * Configuración base. `ng build` la reemplaza por `environment.production.ts`.
 *
 * `apiBaseUrl` es relativa a propósito: en desarrollo el servidor de Angular
 * redirige `/api` al backend y en producción se sirve tras el mismo origen,
 * de modo que la cookie `HttpOnly` del refresh viaja sin depender de CORS.
 */
export const environment = {
  production: false,
  apiBaseUrl: '/api/v1',
} as const;
