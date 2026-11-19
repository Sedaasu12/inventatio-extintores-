import { ApiError } from '../../common/errors/api-error';
import { calendarDateOf } from '../../common/time/event-dates';
import { MAX_CHECKLIST_BYTES, normalizeChecklist } from './inspection-policy';

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    return;
  }
  throw new Error('Se esperaba un ApiError.');
}

describe('inspection-policy', () => {
  describe('normalizeChecklist', () => {
    it('acepta un objeto JSON dentro del límite', () => {
      const checklist = { presion: 'OK', precinto: 'OK' };
      expect(normalizeChecklist(checklist)).toBe(checklist);
    });

    it('devuelve null cuando no se informa', () => {
      expect(normalizeChecklist(undefined)).toBeNull();
    });

    it('rechaza arreglos y valores nulos', () => {
      expectCode(
        () =>
          normalizeChecklist([1, 2, 3] as unknown as Record<string, unknown>),
        'VALIDATION_ERROR',
      );
      expectCode(
        () => normalizeChecklist(null as unknown as Record<string, unknown>),
        'VALIDATION_ERROR',
      );
    });

    it('rechaza un checklist que supera los 20 KB', () => {
      const checklist = { detalle: 'x'.repeat(MAX_CHECKLIST_BYTES) };
      expectCode(() => normalizeChecklist(checklist), 'VALIDATION_ERROR');
    });
  });

  describe('fecha local del hecho (T-INS-08)', () => {
    it('una inspección a las 02:00 UTC corresponde al día anterior en Lima', () => {
      const inspectedAt = new Date('2026-11-10T02:00:00.000Z');
      expect(calendarDateOf(inspectedAt, 'America/Lima').toISOString()).toBe(
        '2026-11-09T00:00:00.000Z',
      );
    });
  });
});
