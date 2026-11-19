import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiError } from '../errors/api-error';
import { ErrorCodes } from '../errors/error-codes';

/**
 * Ejecución idempotente de operaciones de escritura (fase 4A en adelante).
 *
 * La clave se registra con `UNIQUE(user_id, idempotency_key)` y un hash del
 * payload canónico. Un reintento idéntico devuelve el recurso original; un
 * payload distinto responde 409. El registro vive en la misma transacción
 * `Serializable` que la operación, de modo que un fallo no deja la clave
 * bloqueada.
 */

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSACTION_ATTEMPTS = 3;

type Tx = Prisma.TransactionClient;

export interface IdempotencyRequest {
  actorId: string;
  key: string;
  requestHash: string;
  path: string;
  /** Tipo de recurso que se guarda en `idempotency_records`. */
  resourceType: string;
}

export interface IdempotencyOutcome {
  replayed: boolean;
  resourceId: string;
}

export interface IdempotencyCreateResult {
  resourceId: string;
  responseStatus: number;
}

function isRetryableTransactionError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2034' || error.code === 'P2002')
  );
}

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run(
    request: IdempotencyRequest,
    create: (tx: Tx) => Promise<IdempotencyCreateResult>,
  ): Promise<IdempotencyOutcome> {
    const key = request.key.trim();
    if (key.length === 0 || key.length > 64) {
      throw ApiError.unprocessable(
        ErrorCodes.VALIDATION_ERROR,
        'El encabezado Idempotency-Key es obligatorio y admite hasta 64 caracteres.',
        { field: 'Idempotency-Key' },
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_MS);

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const record = await tx.idempotencyRecord.findUnique({
              where: {
                userId_idempotencyKey: {
                  userId: request.actorId,
                  idempotencyKey: key,
                },
              },
            });

            if (record !== null && record.expiresAt.getTime() > now.getTime()) {
              if (record.requestHash !== request.requestHash) {
                throw new ApiError(
                  409,
                  ErrorCodes.IDEMPOTENCY_CONFLICT,
                  'La clave de idempotencia ya se usó con datos distintos.',
                );
              }
              if (record.status === 'PROCESSING') {
                throw new ApiError(
                  409,
                  ErrorCodes.CONCURRENCY_CONFLICT,
                  'La operación con esta clave está en curso. Espera antes de reintentar.',
                );
              }
              if (
                record.resourceType === request.resourceType &&
                record.resourceId !== null
              ) {
                return { replayed: true, resourceId: record.resourceId };
              }
              throw new ApiError(
                409,
                ErrorCodes.IDEMPOTENCY_CONFLICT,
                'La clave de idempotencia no corresponde a esta operación.',
              );
            }

            if (record !== null) {
              await tx.idempotencyRecord.delete({ where: { id: record.id } });
            }

            await tx.idempotencyRecord.create({
              data: {
                id: randomUUID(),
                userId: request.actorId,
                idempotencyKey: key,
                method: 'POST',
                path: request.path,
                requestHash: request.requestHash,
                status: 'PROCESSING',
                expiresAt,
              },
            });

            const result = await create(tx);

            await tx.idempotencyRecord.update({
              where: {
                userId_idempotencyKey: {
                  userId: request.actorId,
                  idempotencyKey: key,
                },
              },
              data: {
                status: 'COMPLETED',
                responseStatus: result.responseStatus,
                resourceType: request.resourceType,
                resourceId: result.resourceId,
              },
            });

            return { replayed: false, resourceId: result.resourceId };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          isRetryableTransactionError(error) &&
          attempt < MAX_TRANSACTION_ATTEMPTS
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new ApiError(
      409,
      ErrorCodes.CONCURRENCY_CONFLICT,
      'No se pudo completar la operación por concurrencia. Intenta nuevamente.',
    );
  }
}
