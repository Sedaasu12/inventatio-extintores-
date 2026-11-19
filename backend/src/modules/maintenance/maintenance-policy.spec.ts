import { ApiError } from '../../common/errors/api-error';
import {
  calendarDateOf,
  normalizeCostCurrency,
  statusForReturnLocation,
  validateNextDueDate,
  validateReturnInstant,
} from './maintenance-policy';

function expectApiError(
  action: () => unknown,
  code: string,
  status: number,
): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe(code);
    expect((error as ApiError).status).toBe(status);
    return;
  }
  throw new Error('Se esperaba un ApiError.');
}

describe('maintenance-policy', () => {
  describe('calendarDateOf', () => {
    it('T-MAN-16: deriva la fecha local de Lima para un hecho de 02:00 UTC', () => {
      const performedOn = calendarDateOf(
        new Date('2026-11-18T02:00:00.000Z'),
        'America/Lima',
      );
      expect(performedOn.toISOString()).toBe('2026-11-17T00:00:00.000Z');
    });
  });

  describe('validateNextDueDate', () => {
    const performedOn = new Date('2026-11-17T00:00:00.000Z');

    it('T-MAN-16: acepta la próxima fecha del día siguiente local', () => {
      expect(() =>
        validateNextDueDate(new Date('2026-11-18T00:00:00.000Z'), performedOn),
      ).not.toThrow();
    });

    it('rechaza una próxima fecha igual o anterior', () => {
      expectApiError(
        () => validateNextDueDate(performedOn, performedOn),
        'PRESCRIPTION_INVALID',
        422,
      );
      expectApiError(
        () =>
          validateNextDueDate(
            new Date('2026-11-16T00:00:00.000Z'),
            performedOn,
          ),
        'PRESCRIPTION_INVALID',
        422,
      );
    });
  });

  describe('normalizeCostCurrency', () => {
    it('devuelve ambos nulos cuando no se informa costo', () => {
      expect(normalizeCostCurrency(undefined, undefined)).toEqual({
        cost: null,
        currency: null,
      });
    });

    it('normaliza la moneda a mayúsculas', () => {
      expect(normalizeCostCurrency(150, 'pen')).toEqual({
        cost: 150,
        currency: 'PEN',
      });
    });

    it('exige moneda cuando hay costo', () => {
      expectApiError(
        () => normalizeCostCurrency(150, undefined),
        'VALIDATION_ERROR',
        422,
      );
    });

    it('rechaza moneda sin costo', () => {
      expectApiError(
        () => normalizeCostCurrency(undefined, 'PEN'),
        'VALIDATION_ERROR',
        422,
      );
    });

    it('rechaza costos negativos', () => {
      expectApiError(
        () => normalizeCostCurrency(-1, 'PEN'),
        'VALIDATION_ERROR',
        422,
      );
    });

    it('rechaza monedas que no son ISO 4217 de tres letras', () => {
      expectApiError(
        () => normalizeCostCurrency(10, 'PE'),
        'VALIDATION_ERROR',
        422,
      );
    });
  });

  describe('statusForReturnLocation', () => {
    it('deriva EN_ALMACEN y ASIGNADO', () => {
      expect(statusForReturnLocation('ALMACEN')).toBe('EN_ALMACEN');
      expect(statusForReturnLocation('AREA')).toBe('ASIGNADO');
    });

    it('no permite retorno a taller', () => {
      expectApiError(
        () => statusForReturnLocation('TALLER'),
        'DESTINATION_INVALID',
        422,
      );
    });
  });

  describe('validateReturnInstant', () => {
    const openedAt = new Date('2026-11-17T15:00:00.000Z');
    const serviceAt = new Date('2026-11-17T16:00:00.000Z');
    const now = new Date('2026-11-17T18:00:00.000Z');

    it('acepta un retorno posterior al servicio', () => {
      expect(() =>
        validateReturnInstant(
          new Date('2026-11-17T17:00:00.000Z'),
          openedAt,
          serviceAt,
          now,
        ),
      ).not.toThrow();
    });

    it('rechaza un retorno anterior al envío', () => {
      expectApiError(
        () =>
          validateReturnInstant(
            new Date('2026-11-17T14:00:00.000Z'),
            openedAt,
            null,
            now,
          ),
        'DATE_BEFORE_EVENT',
        422,
      );
    });

    it('rechaza un retorno anterior al último servicio', () => {
      expectApiError(
        () =>
          validateReturnInstant(
            new Date('2026-11-17T15:30:00.000Z'),
            openedAt,
            serviceAt,
            now,
          ),
        'DATE_BEFORE_EVENT',
        422,
      );
    });

    it('rechaza un retorno futuro', () => {
      expectApiError(
        () =>
          validateReturnInstant(
            new Date('2026-11-17T20:00:00.000Z'),
            openedAt,
            serviceAt,
            now,
          ),
        'DATE_IN_FUTURE',
        422,
      );
    });
  });
});
