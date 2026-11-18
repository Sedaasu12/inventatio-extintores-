import {
  IMPORT_DRY_RUN_TTL_MS,
  computeImportRequestHash,
  createDryRunToken,
  verifyDryRunToken,
} from './import-token';
import type { ImportRequestInput } from './import-token';
import { ImportFormat } from './import-file';

const SECRET = 'secreto-de-pruebas-con-longitud-suficiente';

function requestInput(
  overrides: Partial<ImportRequestInput> = {},
): ImportRequestInput {
  return {
    file: Buffer.from('contenido', 'utf8'),
    format: ImportFormat.CSV,
    receivedBy: 'Carlos Ruiz',
    documentRef: 'ACTA-001',
    reason: 'Carga inicial conciliada',
    ...overrides,
  };
}

describe('import-token', () => {
  it('emite y verifica un comprobante vigente', () => {
    const requestHash = computeImportRequestHash(requestInput());
    const now = new Date('2026-11-17T12:00:00.000Z');
    const { token, expiresAt } = createDryRunToken(
      { requestHash, actorId: 'user-1' },
      SECRET,
      now,
    );

    expect(expiresAt.getTime()).toBe(now.getTime() + IMPORT_DRY_RUN_TTL_MS);
    const payload = verifyDryRunToken(token, SECRET, now);
    expect(payload).toMatchObject({ requestHash, actorId: 'user-1' });
    expect(typeof payload?.jti).toBe('string');
  });

  it('rechaza un comprobante vencido', () => {
    const requestHash = computeImportRequestHash(requestInput());
    const now = new Date('2026-11-17T12:00:00.000Z');
    const { token } = createDryRunToken(
      { requestHash, actorId: 'user-1' },
      SECRET,
      now,
    );
    const later = new Date(now.getTime() + IMPORT_DRY_RUN_TTL_MS + 1);
    expect(verifyDryRunToken(token, SECRET, later)).toBeNull();
  });

  it('rechaza un comprobante alterado o firmado con otro secreto', () => {
    const requestHash = computeImportRequestHash(requestInput());
    const { token } = createDryRunToken(
      { requestHash, actorId: 'user-1' },
      SECRET,
    );
    const [body, signature] = token.split('.');
    const tampered = signature.endsWith('A')
      ? `${signature.slice(0, -1)}B`
      : `${signature.slice(0, -1)}A`;
    expect(verifyDryRunToken(`${body}.${tampered}`, SECRET)).toBeNull();
    expect(verifyDryRunToken(token, `${SECRET}-otro`)).toBeNull();
    expect(verifyDryRunToken('sin-punto', SECRET)).toBeNull();
  });

  it('cambia la huella si cambia el archivo o los campos comunes', () => {
    const base = computeImportRequestHash(requestInput());
    expect(
      computeImportRequestHash(
        requestInput({ file: Buffer.from('otro', 'utf8') }),
      ),
    ).not.toBe(base);
    expect(
      computeImportRequestHash(requestInput({ reason: 'Otra razón' })),
    ).not.toBe(base);
    expect(
      computeImportRequestHash(requestInput({ format: ImportFormat.JSON })),
    ).not.toBe(base);
  });
});
