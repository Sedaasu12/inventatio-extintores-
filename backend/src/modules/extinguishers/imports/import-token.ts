import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type { ImportFormat } from './import-file';

/** Vigencia del comprobante de dry-run. */
export const IMPORT_DRY_RUN_TTL_MS = 24 * 60 * 60 * 1000;

const TOKEN_VERSION = 1;
const HMAC_CONTEXT = 'extinguisher-import-dry-run:v1';

export interface DryRunTokenPayload {
  v: number;
  jti: string;
  requestHash: string;
  actorId: string;
  exp: number;
}

export interface ImportRequestInput {
  file: Buffer;
  format: ImportFormat;
  receivedBy: string;
  documentRef: string;
  reason: string;
}

/**
 * Huella del archivo y de los campos comunes. La confirmación debe enviar
 * exactamente el mismo contenido; de lo contrario el comprobante no aplica.
 */
export function computeImportRequestHash(input: ImportRequestInput): string {
  const fileHash = createHash('sha256').update(input.file).digest('hex');
  const canonical = JSON.stringify({
    fileHash,
    format: input.format,
    receivedBy: input.receivedBy.trim(),
    documentRef: input.documentRef.trim(),
    reason: input.reason.trim(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}

function signingKey(secret: string): Buffer {
  return createHmac('sha256', secret).update(HMAC_CONTEXT).digest();
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', signingKey(secret))
    .update(body)
    .digest('base64url');
}

/**
 * Emite un comprobante firmado que acredita que el archivo fue validado en un
 * dry-run. No se persiste: la firma, el actor, la huella y la expiración se
 * verifican al confirmar.
 */
export function createDryRunToken(
  input: { requestHash: string; actorId: string },
  secret: string,
  now: Date = new Date(),
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + IMPORT_DRY_RUN_TTL_MS);
  const payload: DryRunTokenPayload = {
    v: TOKEN_VERSION,
    jti: randomUUID(),
    requestHash: input.requestHash,
    actorId: input.actorId,
    exp: expiresAt.getTime(),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body, secret)}`, expiresAt };
}

function isPayload(value: unknown): value is DryRunTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    record.v === TOKEN_VERSION &&
    typeof record.jti === 'string' &&
    typeof record.requestHash === 'string' &&
    typeof record.actorId === 'string' &&
    typeof record.exp === 'number'
  );
}

/**
 * Devuelve el payload si la firma es válida y el comprobante no expiró.
 * Cualquier token alterado, truncado o vencido devuelve `null`.
 */
export function verifyDryRunToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): DryRunTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const [body, signature] = parts;
  if (body === '' || signature === '') {
    return null;
  }

  const expected = createHmac('sha256', signingKey(secret))
    .update(body)
    .digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'base64url');
  } catch {
    return null;
  }
  if (
    provided.length !== expected.length ||
    !timingSafeEqual(provided, expected)
  ) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isPayload(parsed)) {
    return null;
  }
  if (parsed.exp <= now.getTime()) {
    return null;
  }
  return parsed;
}
