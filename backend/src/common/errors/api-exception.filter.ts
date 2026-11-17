import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { ApiError } from './api-error';
import { ErrorCode, ErrorCodes } from './error-codes';

interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId: string | null;
  };
}

const HTTP_CODES: Record<number, ErrorCode> = {
  400: ErrorCodes.VALIDATION_ERROR,
  401: ErrorCodes.UNAUTHENTICATED,
  403: ErrorCodes.FORBIDDEN,
  404: ErrorCodes.NOT_FOUND,
  409: ErrorCodes.CONFLICT,
  422: ErrorCodes.VALIDATION_ERROR,
  429: ErrorCodes.RATE_LIMITED,
};

/**
 * Traduce cualquier excepción al contrato de error de la API.
 * Nunca expone stack traces, SQL ni nombres de tablas.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();
    const requestId = request.requestId ?? null;

    const { status, body } = this.translate(exception, requestId);

    if (status === 429) {
      const details = body.error.details as
        { retryAfterSeconds?: unknown } | undefined;
      const retryAfter = Number(details?.retryAfterSeconds);
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        response.setHeader('Retry-After', Math.ceil(retryAfter).toString());
      }
    }

    if (status >= 500) {
      this.logger.error(
        `Unhandled error on ${request.method} ${request.url} (requestId=${requestId ?? 'none'})`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(body);
  }

  private translate(
    exception: unknown,
    requestId: string | null,
  ): { status: number; body: ErrorBody } {
    if (exception instanceof ApiError) {
      return {
        status: exception.status,
        body: {
          error: {
            code: exception.code,
            message: exception.message,
            ...(exception.details === undefined
              ? {}
              : { details: exception.details }),
            requestId,
          },
        },
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const details = this.extractDetails(payload);
      const message = this.extractMessage(payload, status);

      return {
        status,
        body: {
          error: {
            code: HTTP_CODES[status] ?? ErrorCodes.INTERNAL_ERROR,
            message,
            ...(details === undefined ? {} : { details }),
            requestId,
          },
        },
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        return {
          status: HttpStatus.CONFLICT,
          body: {
            error: {
              code: ErrorCodes.CONFLICT,
              message: 'El registro entra en conflicto con uno existente.',
              requestId,
            },
          },
        };
      }
      if (exception.code === 'P2025') {
        return {
          status: HttpStatus.NOT_FOUND,
          body: {
            error: {
              code: ErrorCodes.NOT_FOUND,
              message: 'El recurso solicitado no existe.',
              requestId,
            },
          },
        };
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        error: {
          code: ErrorCodes.INTERNAL_ERROR,
          message: 'Ocurrió un error interno. Intenta nuevamente.',
          requestId,
        },
      },
    };
  }

  private extractDetails(payload: unknown): unknown {
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.message)) {
        return record.message;
      }
    }
    return undefined;
  }

  private extractMessage(payload: unknown, status: number): string {
    if (typeof payload === 'string' && payload.length > 0) {
      return payload;
    }
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      if (Array.isArray(record.message)) {
        return 'La solicitud contiene datos inválidos.';
      }
      if (typeof record.message === 'string' && record.message.length > 0) {
        return record.message;
      }
    }
    if (status === 401) {
      return 'Debes iniciar sesión para continuar.';
    }
    if (status === 403) {
      return 'No tienes permiso para realizar esta acción.';
    }
    if (status === 404) {
      return 'El recurso solicitado no existe.';
    }
    return 'La solicitud no se pudo procesar.';
  }
}
