import { ApiError } from '../../common/errors/api-error';
import {
  AssetMovementState,
  CLOCK_TOLERANCE_MS,
  parseMovedAt,
  validateAdjustment,
  validateMovedAt,
  validateOperationalMovement,
  validateRetirement,
} from './movement-policy';

const NOW = new Date('2026-11-17T12:00:00.000Z');

function asset(
  overrides: Partial<AssetMovementState> = {},
): AssetMovementState {
  return {
    id: 'asset-1',
    logisticsStatus: 'EN_ALMACEN',
    technicalCondition: 'OPERATIVO',
    placementType: 'INTERNAL',
    currentLocationId: 'warehouse-1',
    currentLocationType: 'ALMACEN',
    currentExternalPartyId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    lastMovementAt: new Date('2026-06-01T00:00:00.000Z'),
    hasActiveMaintenanceOrder: false,
    ...overrides,
  };
}

function expectApiError(
  callback: () => unknown,
  status: number,
  code: string,
): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(status);
    expect(apiError.code).toBe(code);
    return;
  }
  throw new Error(`Se esperaba un ApiError ${status} ${code}.`);
}

describe('movement-policy: fechas', () => {
  it('acepta instantes con zona horaria y rechaza fechas sin zona', () => {
    expect(parseMovedAt('2026-11-10T15:30:00-05:00').toISOString()).toBe(
      '2026-11-10T20:30:00.000Z',
    );
    expect(parseMovedAt('2026-11-10T20:30:00Z').toISOString()).toBe(
      '2026-11-10T20:30:00.000Z',
    );

    expectApiError(
      () => parseMovedAt('2026-11-10T15:30:00'),
      422,
      'VALIDATION_ERROR',
    );
    expectApiError(
      () => parseMovedAt('2026-02-31T10:00:00Z'),
      422,
      'VALIDATION_ERROR',
    );
    expectApiError(
      () => parseMovedAt('2026-11-10T25:00:00Z'),
      422,
      'VALIDATION_ERROR',
    );
  });

  it('rechaza fechas futuras más allá de la tolerancia', () => {
    const future = new Date(NOW.getTime() + CLOCK_TOLERANCE_MS + 1000);
    expectApiError(
      () => validateMovedAt(future, asset(), NOW),
      422,
      'DATE_IN_FUTURE',
    );

    const withinTolerance = new Date(NOW.getTime() + CLOCK_TOLERANCE_MS - 1000);
    expect(() => validateMovedAt(withinTolerance, asset(), NOW)).not.toThrow();
  });

  it('rechaza fechas anteriores al alta o al último movimiento', () => {
    expectApiError(
      () => validateMovedAt(new Date('2025-12-31T23:00:00Z'), asset(), NOW),
      422,
      'DATE_BEFORE_EVENT',
    );

    expectApiError(
      () => validateMovedAt(new Date('2026-05-31T23:59:59Z'), asset(), NOW),
      422,
      'DATE_BEFORE_EVENT',
    );

    expect(() =>
      validateMovedAt(new Date('2026-06-01T00:00:00Z'), asset(), NOW),
    ).not.toThrow();
  });
});

describe('movement-policy: SALIDA', () => {
  it('permite salir de un almacén hacia un área', () => {
    const result = validateOperationalMovement({
      type: 'SALIDA',
      originLocationId: 'warehouse-1',
      destinationLocationId: 'area-1',
      destinationLocationType: 'AREA',
      asset: asset(),
    });
    expect(result.logisticsStatus).toBe('ASIGNADO');
  });

  it('rechaza un origen distinto de la ubicación actual', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'warehouse-2',
          destinationLocationId: 'area-1',
          destinationLocationType: 'AREA',
          asset: asset(),
        }),
      409,
      'ORIGIN_MISMATCH',
    );
  });

  it('rechaza la salida desde un área', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'area-1',
          destinationLocationId: 'area-2',
          destinationLocationType: 'AREA',
          asset: asset({
            logisticsStatus: 'ASIGNADO',
            currentLocationId: 'area-1',
            currentLocationType: 'AREA',
          }),
        }),
      409,
      'INVALID_TRANSITION',
    );
  });

  it('rechaza destinos que no son área o iguales al origen', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'warehouse-2',
          destinationLocationType: 'ALMACEN',
          asset: asset(),
        }),
      422,
      'DESTINATION_INVALID',
    );

    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'warehouse-1',
          destinationLocationType: 'ALMACEN',
          asset: asset(),
        }),
      422,
      'DESTINATION_INVALID',
    );
  });
});

describe('movement-policy: TRASLADO y RETORNO_ALMACEN', () => {
  it('traslada entre almacenes y entre áreas con el estado correcto', () => {
    expect(
      validateOperationalMovement({
        type: 'TRASLADO',
        originLocationId: 'warehouse-1',
        destinationLocationId: 'warehouse-2',
        destinationLocationType: 'ALMACEN',
        asset: asset(),
      }).logisticsStatus,
    ).toBe('EN_ALMACEN');

    expect(
      validateOperationalMovement({
        type: 'TRASLADO',
        originLocationId: 'area-1',
        destinationLocationId: 'area-2',
        destinationLocationType: 'AREA',
        asset: asset({
          logisticsStatus: 'ASIGNADO',
          currentLocationId: 'area-1',
          currentLocationType: 'AREA',
        }),
      }).logisticsStatus,
    ).toBe('ASIGNADO');
  });

  it('rechaza combinaciones almacén→área y área→almacén', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'TRASLADO',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'area-1',
          destinationLocationType: 'AREA',
          asset: asset(),
        }),
      422,
      'DESTINATION_INVALID',
    );

    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'TRASLADO',
          originLocationId: 'area-1',
          destinationLocationId: 'warehouse-2',
          destinationLocationType: 'ALMACEN',
          asset: asset({
            logisticsStatus: 'ASIGNADO',
            currentLocationId: 'area-1',
            currentLocationType: 'AREA',
          }),
        }),
      422,
      'DESTINATION_INVALID',
    );
  });

  it('reserva TALLER para mantenimiento', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'TRASLADO',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'workshop-1',
          destinationLocationType: 'TALLER',
          asset: asset(),
        }),
      422,
      'DESTINATION_INVALID',
    );
  });

  it('retorna de área a almacén y rechaza otros orígenes o destinos', () => {
    expect(
      validateOperationalMovement({
        type: 'RETORNO_ALMACEN',
        originLocationId: 'area-1',
        destinationLocationId: 'warehouse-1',
        destinationLocationType: 'ALMACEN',
        asset: asset({
          logisticsStatus: 'ASIGNADO',
          currentLocationId: 'area-1',
          currentLocationType: 'AREA',
        }),
      }).logisticsStatus,
    ).toBe('EN_ALMACEN');

    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'RETORNO_ALMACEN',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'warehouse-2',
          destinationLocationType: 'ALMACEN',
          asset: asset(),
        }),
      409,
      'INVALID_TRANSITION',
    );

    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'RETORNO_ALMACEN',
          originLocationId: 'area-1',
          destinationLocationId: 'area-2',
          destinationLocationType: 'AREA',
          asset: asset({
            logisticsStatus: 'ASIGNADO',
            currentLocationId: 'area-1',
            currentLocationType: 'AREA',
          }),
        }),
      422,
      'DESTINATION_INVALID',
    );
  });
});

describe('movement-policy: estados y condición', () => {
  it('rechaza movimientos de activos dados de baja o en mantenimiento', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'area-1',
          destinationLocationType: 'AREA',
          asset: asset({ logisticsStatus: 'DADO_DE_BAJA' }),
        }),
      409,
      'ASSET_RETIRED',
    );

    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'area-1',
          destinationLocationType: 'AREA',
          asset: asset({ logisticsStatus: 'EN_MANTENIMIENTO' }),
        }),
      409,
      'INVALID_TRANSITION',
    );
  });

  it('no permite asignar un equipo NO_OPERATIVO a un área', () => {
    expectApiError(
      () =>
        validateOperationalMovement({
          type: 'SALIDA',
          originLocationId: 'warehouse-1',
          destinationLocationId: 'area-1',
          destinationLocationType: 'AREA',
          asset: asset({ technicalCondition: 'NO_OPERATIVO' }),
        }),
      422,
      'CONDITION_NOT_ASSIGNABLE',
    );

    expect(
      validateOperationalMovement({
        type: 'TRASLADO',
        originLocationId: 'warehouse-1',
        destinationLocationId: 'warehouse-2',
        destinationLocationType: 'ALMACEN',
        asset: asset({ technicalCondition: 'NO_OPERATIVO' }),
      }).logisticsStatus,
    ).toBe('EN_ALMACEN');
  });
});

describe('movement-policy: BAJA', () => {
  it('permite la baja de un activo interno sin orden activa', () => {
    expect(() => validateRetirement(asset())).not.toThrow();
    expect(() =>
      validateRetirement(
        asset({
          logisticsStatus: 'ASIGNADO',
          currentLocationId: 'area-1',
          currentLocationType: 'AREA',
        }),
      ),
    ).not.toThrow();
  });

  it('rechaza baja de un activo ya retirado', () => {
    expectApiError(
      () => validateRetirement(asset({ logisticsStatus: 'DADO_DE_BAJA' })),
      409,
      'ASSET_RETIRED',
    );
  });

  it('rechaza baja con orden activa o en mantenimiento', () => {
    expectApiError(
      () => validateRetirement(asset({ hasActiveMaintenanceOrder: true })),
      409,
      'MAINTENANCE_ORDER_ACTIVE',
    );

    expectApiError(
      () => validateRetirement(asset({ logisticsStatus: 'EN_MANTENIMIENTO' })),
      409,
      'INVALID_TRANSITION',
    );
  });

  it('rechaza baja de un activo colocado en una entidad externa', () => {
    expectApiError(
      () =>
        validateRetirement(
          asset({
            placementType: 'EXTERNAL',
            currentLocationId: null,
            currentLocationType: null,
            currentExternalPartyId: 'party-1',
          }),
        ),
      409,
      'INVALID_TRANSITION',
    );
  });
});

describe('movement-policy: AJUSTE', () => {
  it('deriva el estado de la colocación corregida', () => {
    expect(
      validateAdjustment({
        asset: asset({
          logisticsStatus: 'ASIGNADO',
          currentLocationId: 'area-1',
          currentLocationType: 'AREA',
        }),
        target: {
          kind: 'INTERNAL',
          locationId: 'warehouse-2',
          locationType: 'ALMACEN',
        },
        correctsMovement: null,
      }),
    ).toEqual({ logisticsStatus: 'EN_ALMACEN', reactivates: false });

    expect(
      validateAdjustment({
        asset: asset(),
        target: {
          kind: 'INTERNAL',
          locationId: 'area-1',
          locationType: 'AREA',
        },
        correctsMovement: null,
      }).logisticsStatus,
    ).toBe('ASIGNADO');

    expect(
      validateAdjustment({
        asset: asset(),
        target: {
          kind: 'INTERNAL',
          locationId: 'workshop-1',
          locationType: 'TALLER',
        },
        correctsMovement: null,
      }).logisticsStatus,
    ).toBe('EN_MANTENIMIENTO');

    expect(
      validateAdjustment({
        asset: asset(),
        target: { kind: 'EXTERNAL', externalPartyId: 'party-1' },
        correctsMovement: null,
      }).logisticsStatus,
    ).toBe('EN_MANTENIMIENTO');
  });

  it('exige el movimiento de baja para reactivar un activo retirado', () => {
    const retired = asset({
      logisticsStatus: 'DADO_DE_BAJA',
      placementType: 'NONE',
      currentLocationId: null,
      currentLocationType: null,
    });

    expectApiError(
      () =>
        validateAdjustment({
          asset: retired,
          target: {
            kind: 'INTERNAL',
            locationId: 'warehouse-1',
            locationType: 'ALMACEN',
          },
          correctsMovement: null,
        }),
      422,
      'VALIDATION_ERROR',
    );

    expectApiError(
      () =>
        validateAdjustment({
          asset: retired,
          target: {
            kind: 'INTERNAL',
            locationId: 'warehouse-1',
            locationType: 'ALMACEN',
          },
          correctsMovement: { id: 'movement-1', movementType: 'SALIDA' },
        }),
      422,
      'VALIDATION_ERROR',
    );

    expect(
      validateAdjustment({
        asset: retired,
        target: {
          kind: 'INTERNAL',
          locationId: 'warehouse-1',
          locationType: 'ALMACEN',
        },
        correctsMovement: { id: 'movement-1', movementType: 'BAJA' },
      }),
    ).toEqual({ logisticsStatus: 'EN_ALMACEN', reactivates: true });
  });

  it('rechaza ajustes que no cambian la colocación o usan una sede', () => {
    expectApiError(
      () =>
        validateAdjustment({
          asset: asset(),
          target: {
            kind: 'INTERNAL',
            locationId: 'warehouse-1',
            locationType: 'ALMACEN',
          },
          correctsMovement: null,
        }),
      422,
      'DESTINATION_INVALID',
    );

    expectApiError(
      () =>
        validateAdjustment({
          asset: asset(),
          target: {
            kind: 'INTERNAL',
            locationId: 'sede-1',
            locationType: 'SEDE',
          },
          correctsMovement: null,
        }),
      422,
      'DESTINATION_INVALID',
    );
  });

  it('no permite ajustar un NO_OPERATIVO a un área', () => {
    expectApiError(
      () =>
        validateAdjustment({
          asset: asset({ technicalCondition: 'NO_OPERATIVO' }),
          target: {
            kind: 'INTERNAL',
            locationId: 'area-1',
            locationType: 'AREA',
          },
          correctsMovement: null,
        }),
      422,
      'CONDITION_NOT_ASSIGNABLE',
    );
  });
});
