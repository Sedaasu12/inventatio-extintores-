import { HttpErrorResponse } from '@angular/common/http';

/** Forma del cuerpo de error que devuelve la API. */
export interface ApiErrorBody {
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
    requestId?: unknown;
  };
}

/** Códigos estables del contrato; nunca se traducen ni se comparan por texto. */
export const ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION: 'VALIDATION_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  SERVER: 'INTERNAL_ERROR',
  PASSWORD_CHANGE_REQUIRED: 'PASSWORD_CHANGE_REQUIRED',
  IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
  CONCURRENCY: 'CONCURRENCY_CONFLICT',
} as const;

function codeForStatus(status: number): string {
  switch (status) {
    case 0:
      return ERROR_CODES.NETWORK;
    case 401:
      return ERROR_CODES.UNAUTHENTICATED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 409:
      return ERROR_CODES.CONFLICT;
    case 422:
      return ERROR_CODES.VALIDATION;
    case 429:
      return ERROR_CODES.TOO_MANY_REQUESTS;
    default:
      return status >= 500 ? ERROR_CODES.SERVER : ERROR_CODES.UNKNOWN;
  }
}

/** `Retry-After` admite segundos o una fecha HTTP. */
function parseRetryAfter(value: string | null): number | null {
  if (value === null || value.trim() === '') {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.ceil(seconds));
  }
  const date = Date.parse(value);
  if (Number.isNaN(date)) {
    return null;
  }
  return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/**
 * Error normalizado para la interfaz. Conserva el código estable para la
 * lógica del cliente, el `requestId` para soporte y el mensaje del servidor
 * como respaldo; la traducción se resuelve en `I18nService`.
 */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly serverMessage: string,
    readonly details?: unknown,
    readonly requestId?: string | null,
    readonly retryAfterSeconds?: number | null,
  ) {
    super(serverMessage);
    this.name = 'ApiClientError';
  }

  static fromResponse(response: HttpErrorResponse): ApiClientError {
    const body = response.error as ApiErrorBody | string | null;
    const payload = typeof body === 'object' && body !== null ? body.error : undefined;
    const code =
      typeof payload?.code === 'string' && payload.code !== ''
        ? payload.code
        : codeForStatus(response.status);
    const serverMessage =
      typeof payload?.message === 'string' && payload.message !== ''
        ? payload.message
        : response.message;
    const requestId =
      typeof payload?.requestId === 'string'
        ? payload.requestId
        : response.headers.get('X-Request-Id');

    return new ApiClientError(
      response.status,
      code,
      serverMessage,
      payload?.details,
      requestId,
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }

  static fromUnknown(error: unknown): ApiClientError {
    if (error instanceof ApiClientError) {
      return error;
    }
    if (error instanceof HttpErrorResponse) {
      return ApiClientError.fromResponse(error);
    }
    const message = error instanceof Error ? error.message : '';
    return new ApiClientError(0, ERROR_CODES.UNKNOWN, message);
  }
}
