import { ApiError } from '../../common/errors/api-error';
import { ErrorCodes } from '../../common/errors/error-codes';

/**
 * Reglas puras de la inspección (fase 6B).
 *
 * Las fechas y la proyección de vencimientos se comparten con el módulo de
 * mantenimiento en `common/time/event-dates` y `due-dates`. Aquí solo vive lo
 * específico de la inspección: el checklist y la evidencia textual.
 */

/** Tamaño máximo del checklist serializado (20 KB). */
export const MAX_CHECKLIST_BYTES = 20 * 1024;

/**
 * Valida y normaliza el checklist. Es un objeto JSON libre: el sistema no
 * impone un catálogo de ítems (D-10 no define un esquema reglamentario). Un
 * arreglo o un valor nulo se rechazan para mantenerlo como objeto de claves.
 */
export function normalizeChecklist(
  checklist: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (checklist === undefined) {
    return null;
  }
  if (checklist === null || Array.isArray(checklist)) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      'El checklist debe ser un objeto JSON.',
      { field: 'checklist' },
    );
  }

  const bytes = Buffer.byteLength(JSON.stringify(checklist), 'utf8');
  if (bytes > MAX_CHECKLIST_BYTES) {
    throw ApiError.unprocessable(
      ErrorCodes.VALIDATION_ERROR,
      `El checklist supera el tamaño máximo de ${MAX_CHECKLIST_BYTES} bytes.`,
      { field: 'checklist' },
    );
  }

  return checklist;
}
