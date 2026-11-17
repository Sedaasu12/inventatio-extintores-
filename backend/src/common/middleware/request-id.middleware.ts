import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

export const REQUEST_ID_HEADER = 'X-Request-Id';

/**
 * Asigna un identificador de correlación a cada solicitud y lo devuelve en la
 * cabecera. Se usa en errores y auditoría.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: Request & { requestId?: string },
    response: Response,
    next: NextFunction,
  ): void {
    const incoming = request.header(REQUEST_ID_HEADER)?.trim();
    const requestId =
      incoming !== undefined && /^[A-Za-z0-9-]{8,64}$/.test(incoming)
        ? incoming
        : randomUUID();

    request.requestId = requestId;
    response.setHeader(REQUEST_ID_HEADER, requestId);
    next();
  }
}
