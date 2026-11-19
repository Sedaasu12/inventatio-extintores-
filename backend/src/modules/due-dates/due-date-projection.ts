import {
  DueDateEventType,
  DueDateSourceType,
  Prisma,
  ServiceType,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

/**
 * Proyección `due_dates` a partir de hechos técnicos (servicios e
 * inspecciones).
 *
 * Reglas:
 * - Cada categoría se actualiza por separado (BR-106).
 * - Un evento posterior reemplaza la proyección; uno anterior no la pisa
 *   (BR-111 / BR-112). En empate gana el evento registrado después.
 * - Un evento sin próxima fecha deja la categoría sin fecha configurada
 *   (BR-088 / BR-105), pero solo si es el evento más reciente.
 * - La categoría `EQUIPO` se calcula en otro servicio y no pasa por aquí.
 */

/** Categoría de fecha objetivo que actualiza cada tipo de servicio. */
export function eventTypeForService(
  serviceType: ServiceType,
): DueDateEventType {
  switch (serviceType) {
    case 'RECARGA':
      return 'RECARGA';
    case 'PRUEBA_HIDROSTATICA':
      return 'PRUEBA_HIDROSTATICA';
    case 'MANTENIMIENTO':
    case 'REPARACION':
      // Supuesto documentado: una reparación se registra como atención de
      // mantenimiento y actualiza la fecha objetivo `MANTENIMIENTO`.
      return 'MANTENIMIENTO';
  }
}

export interface ExistingProjection {
  sourceEventAt: Date | null;
}

/**
 * `true` cuando el evento entrante puede reemplazar la proyección vigente.
 * Un evento con fecha de hecho anterior no la reemplaza (BR-111).
 */
export function shouldReplaceProjection(
  existing: ExistingProjection | null,
  sourceEventAt: Date,
): boolean {
  if (existing === null) {
    return true;
  }
  if (existing.sourceEventAt === null) {
    return true;
  }
  return sourceEventAt.getTime() >= existing.sourceEventAt.getTime();
}

export interface DueDateProjectionInput {
  extinguisherId: string;
  eventType: DueDateEventType;
  /** `null` deja la categoría sin fecha configurada. */
  dueDate: Date | null;
  sourceType: DueDateSourceType;
  sourceId: string;
  sourceEventAt: Date;
}

export type DueDateProjectionResult = 'SKIPPED' | 'DELETED' | 'UPSERTED';

type ProjectionClient = Pick<Prisma.TransactionClient, 'dueDate'>;

/**
 * Aplica la proyección dentro de la transacción que registra el hecho.
 * Devuelve qué ocurrió para poder auditar o probar el comportamiento.
 */
export async function applyDueDateProjection(
  client: ProjectionClient,
  input: DueDateProjectionInput,
): Promise<DueDateProjectionResult> {
  const existing = await client.dueDate.findUnique({
    where: {
      extinguisherId_eventType: {
        extinguisherId: input.extinguisherId,
        eventType: input.eventType,
      },
    },
    select: { sourceEventAt: true },
  });

  if (!shouldReplaceProjection(existing, input.sourceEventAt)) {
    return 'SKIPPED';
  }

  if (input.dueDate === null) {
    await client.dueDate.deleteMany({
      where: {
        extinguisherId: input.extinguisherId,
        eventType: input.eventType,
      },
    });
    return 'DELETED';
  }

  await client.dueDate.upsert({
    where: {
      extinguisherId_eventType: {
        extinguisherId: input.extinguisherId,
        eventType: input.eventType,
      },
    },
    create: {
      id: randomUUID(),
      extinguisherId: input.extinguisherId,
      eventType: input.eventType,
      dueDate: input.dueDate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceEventAt: input.sourceEventAt,
    },
    update: {
      dueDate: input.dueDate,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceEventAt: input.sourceEventAt,
    },
  });

  return 'UPSERTED';
}
