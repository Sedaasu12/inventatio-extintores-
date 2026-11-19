import { ApiError } from '../errors/api-error';
import {
  CLOCK_TOLERANCE_MS,
  assertNotBefore,
  assertNotFuture,
  parseInstant,
} from './instant';

function expectApiError(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    return;
  }
  throw new Error('Se esperaba un ApiError.');
}

describe('instant', () => {
  describe('parseInstant', () => {
    it('acepta segundos con fracción, incluido el segundo 59', () => {
      expect(parseInstant('2026-11-19T14:35:59.120Z', 'x').toISOString()).toBe(
        '2026-11-19T14:35:59.120Z',
      );
      expect(parseInstant('2026-11-19T14:35:59.999Z', 'x').toISOString()).toBe(
        '2026-11-19T14:35:59.999Z',
      );
      expect(parseInstant('2026-11-19T14:35:59.000Z', 'x').toISOString()).toBe(
        '2026-11-19T14:35:59.000Z',
      );
    });

    it('acepta instantes sin fracción y con desplazamiento horario', () => {
      expect(parseInstant('2026-11-19T14:35:59Z', 'x').toISOString()).toBe(
        '2026-11-19T14:35:59.000Z',
      );
      expect(parseInstant('2026-11-19T09:35:59-05:00', 'x').toISOString()).toBe(
        '2026-11-19T14:35:59.000Z',
      );
    });

    it('rechaza instantes sin zona horaria', () => {
      expectApiError(
        () => parseInstant('2026-11-19T14:35:59', 'x'),
        'VALIDATION_ERROR',
      );
    });

    it('rechaza fechas de calendario irreales', () => {
      expectApiError(
        () => parseInstant('2026-02-31T14:35:59Z', 'x'),
        'VALIDATION_ERROR',
      );
    });
  });

  describe('assertNotFuture', () => {
    const now = new Date('2026-11-19T12:00:00.000Z');

    it('tolera el desfase de reloj configurado', () => {
      expect(() =>
        assertNotFuture(
          new Date(now.getTime() + CLOCK_TOLERANCE_MS),
          'x',
          undefined,
          now,
        ),
      ).not.toThrow();
    });

    it('rechaza un instante más allá de la tolerancia', () => {
      expectApiError(
        () =>
          assertNotFuture(
            new Date(now.getTime() + CLOCK_TOLERANCE_MS + 1),
            'x',
            undefined,
            now,
          ),
        'DATE_IN_FUTURE',
      );
    });
  });

  describe('assertNotBefore', () => {
    const floor = new Date('2026-11-19T12:00:00.000Z');

    it('acepta el mismo instante que el límite', () => {
      expect(() => assertNotBefore(floor, floor, 'x', 'm')).not.toThrow();
    });

    it('rechaza un instante anterior al límite', () => {
      expectApiError(
        () => assertNotBefore(new Date(floor.getTime() - 1), floor, 'x', 'm'),
        'DATE_BEFORE_EVENT',
      );
    });
  });
});
