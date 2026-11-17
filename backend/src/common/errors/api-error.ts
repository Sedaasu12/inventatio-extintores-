import { ErrorCode, ErrorCodes } from './error-codes';

/**
 * Error de negocio con código estable. El filtro global lo transforma al
 * formato `{ error: { code, message, details?, requestId } }`.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static unauthorized(
    code: ErrorCode = ErrorCodes.UNAUTHENTICATED,
    message = 'Debes iniciar sesión para continuar.',
  ): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(
    message = 'No tienes permiso para realizar esta acción.',
    code: ErrorCode = ErrorCodes.FORBIDDEN,
  ): ApiError {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'El recurso solicitado no existe.'): ApiError {
    return new ApiError(404, ErrorCodes.NOT_FOUND, message);
  }

  static conflict(code: ErrorCode, message: string): ApiError {
    return new ApiError(409, code, message);
  }

  static unprocessable(
    code: ErrorCode,
    message: string,
    details?: unknown,
  ): ApiError {
    return new ApiError(422, code, message, details);
  }

  static tooManyRequests(message: string): ApiError {
    return new ApiError(429, ErrorCodes.RATE_LIMITED, message);
  }
}
