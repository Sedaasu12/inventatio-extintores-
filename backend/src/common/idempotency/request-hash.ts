import { createHash } from 'node:crypto';

/**
 * Hash canónico de un payload idempotente. El orden de las claves lo define
 * quien construye el objeto, no el cliente, para que el mismo contenido
 * produzca siempre el mismo hash.
 */
export function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
