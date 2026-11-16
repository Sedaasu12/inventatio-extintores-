/**
 * Pruebas de integración de las restricciones declarativas C-01..C-15, C-17,
 * C-18 y C-19 de `docs/modelo-entidad-relacion.md`.
 *
 * C-16 y C-17 (parte de sedes) son validaciones de servicio: se prueban en la
 * fase que implemente esos servicios, no aquí.
 */
import { randomUUID } from 'node:crypto';
import {
  BaseFixtures,
  createBaseFixtures,
  createExtinguisher,
  createMovement,
  createOrder,
  expectRejection,
  prisma,
  resetDatabase,
} from './test-db';

let fixtures: BaseFixtures;

beforeEach(async () => {
  await resetDatabase();
  fixtures = await createBaseFixtures();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('C-01 asset_code único', () => {
  it('rechaza un segundo extintor con el mismo código', async () => {
    await createExtinguisher(fixtures, { assetCode: 'EXT-000001' });

    const message = await expectRejection(() =>
      createExtinguisher(fixtures, { assetCode: 'EXT-000001' }),
    );

    expect(message).toMatch(/asset_code/);
  });
});

describe('C-02 patrón de asset_code', () => {
  it('rechaza códigos en minúsculas o demasiado cortos', async () => {
    const lowercase = await expectRejection(() =>
      createExtinguisher(fixtures, { assetCode: 'ext-000001' }),
    );
    const tooShort = await expectRejection(() =>
      createExtinguisher(fixtures, { assetCode: 'AB' }),
    );

    expect(lowercase).toMatch(/extinguishers_asset_code_chk/);
    expect(tooShort).toMatch(/extinguishers_asset_code_chk/);
  });

  it('acepta el formato generado EXT-000009', async () => {
    const created = await createExtinguisher(fixtures, {
      assetCode: 'EXT-000009',
    });

    expect(created.assetCode).toBe('EXT-000009');
  });
});

describe('C-03 colocación interna o externa, no ambas', () => {
  it('rechaza INTERNAL con ubicación y contraparte externa', async () => {
    const message = await expectRejection(() =>
      createExtinguisher(fixtures, {
        placementType: 'INTERNAL',
        currentLocationId: fixtures.warehouseId,
        currentExternalPartyId: fixtures.providerId,
      }),
    );

    expect(message).toMatch(/extinguishers_placement_chk/);
  });

  it('rechaza EXTERNAL sin contraparte externa', async () => {
    const message = await expectRejection(() =>
      createExtinguisher(fixtures, {
        placementType: 'EXTERNAL',
        currentLocationId: null,
        currentExternalPartyId: null,
      }),
    );

    expect(message).toMatch(/extinguishers_placement_chk/);
  });

  it('acepta EXTERNAL con contraparte externa', async () => {
    const created = await createExtinguisher(fixtures, {
      placementType: 'EXTERNAL',
      currentExternalPartyId: fixtures.providerId,
    });

    expect(created.id).toBeDefined();
  });
});

describe('C-04 y C-05 coherencia de baja', () => {
  it('rechaza DADO_DE_BAJA sin retired_at', async () => {
    const message = await expectRejection(() =>
      createExtinguisher(fixtures, {
        logisticsStatus: 'DADO_DE_BAJA',
        placementType: 'NONE',
        currentLocationId: null,
        retiredAt: null,
      }),
    );

    expect(message).toMatch(/extinguishers_retired_chk/);
  });

  it('rechaza DADO_DE_BAJA con colocación interna', async () => {
    const message = await expectRejection(() =>
      createExtinguisher(fixtures, {
        logisticsStatus: 'DADO_DE_BAJA',
        placementType: 'INTERNAL',
        currentLocationId: fixtures.warehouseId,
        retiredAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );

    expect(message).toMatch(/extinguishers_retired_chk/);
  });

  it('rechaza retired_at cuando no está dado de baja', async () => {
    const message = await expectRejection(() =>
      createExtinguisher(fixtures, {
        logisticsStatus: 'EN_ALMACEN',
        retiredAt: new Date('2026-03-01T00:00:00.000Z'),
      }),
    );

    expect(message).toMatch(/extinguishers_retired_chk/);
  });

  it('acepta una baja coherente', async () => {
    const created = await createExtinguisher(fixtures, {
      logisticsStatus: 'DADO_DE_BAJA',
      placementType: 'NONE',
      currentLocationId: null,
      retiredAt: new Date('2026-03-01T00:00:00.000Z'),
    });

    expect(created.id).toBeDefined();
  });
});

describe('C-06 row_version', () => {
  it('rechaza row_version 0', async () => {
    const message = await expectRejection(() =>
      createExtinguisher(fixtures, { rowVersion: 0 }),
    );

    expect(message).toMatch(/extinguishers_row_version_chk/);
  });
});

describe('C-07 coherencia de movimientos', () => {
  it('rechaza origen LOCATION sin ubicación', async () => {
    const message = await expectRejection(() =>
      createMovement(fixtures, {
        movementType: 'TRASLADO',
        entrySource: null,
        originKind: 'LOCATION',
        originLocationId: null,
      }),
    );

    expect(message).toMatch(/movements_origin_kind_chk/);
  });

  it('rechaza origen NONE con ubicación informada', async () => {
    const message = await expectRejection(() =>
      createMovement(fixtures, {
        movementType: 'TRASLADO',
        entrySource: null,
        originKind: 'NONE',
        originLocationId: fixtures.warehouseId,
      }),
    );

    expect(message).toMatch(/movements_origin_kind_chk/);
  });

  it('rechaza destino EXTERNAL_PARTY con ubicación informada', async () => {
    const message = await expectRejection(() =>
      createMovement(fixtures, {
        movementType: 'TRASLADO',
        entrySource: null,
        originKind: 'LOCATION',
        originLocationId: fixtures.warehouseId,
        destinationKind: 'EXTERNAL_PARTY',
        destinationLocationId: fixtures.areaId,
        destinationExternalPartyId: fixtures.providerId,
      }),
    );

    expect(message).toMatch(/movements_destination_kind_chk/);
  });

  it('exige entry_source solo en INGRESO', async () => {
    const withoutSource = await expectRejection(() =>
      createMovement(fixtures, { movementType: 'INGRESO', entrySource: null }),
    );
    const sourceOnExit = await expectRejection(() =>
      createMovement(fixtures, {
        movementType: 'SALIDA',
        entrySource: 'COMPRA_LOCAL',
      }),
    );

    expect(withoutSource).toMatch(/movements_entry_source_chk/);
    expect(sourceOnExit).toMatch(/movements_entry_source_chk/);
  });

  it('acepta un traslado coherente', async () => {
    const id = await createMovement(fixtures, {
      movementType: 'TRASLADO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'LOCATION',
      destinationLocationId: fixtures.areaId,
    });

    expect(id).toBeDefined();
  });
});

describe('C-08 secuencia única por activo', () => {
  it('rechaza dos movimientos con la misma secuencia', async () => {
    await createMovement(fixtures, { assetSequence: 2 });

    const message = await expectRejection(() =>
      createMovement(fixtures, { assetSequence: 2 }),
    );

    expect(message).toMatch(/extinguisher_id|asset_sequence/);
  });
});

describe('C-09 idempotencia por usuario', () => {
  it('rechaza la misma clave de idempotencia para el mismo usuario', async () => {
    const base = {
      userId: fixtures.userId,
      idempotencyKey: 'clave-de-pruebas',
      method: 'POST',
      path: '/api/v1/movements',
      requestHash: 'a'.repeat(64),
      status: 'PROCESSING' as const,
      expiresAt: new Date('2026-12-01T00:00:00.000Z'),
    };

    await prisma.idempotencyRecord.create({
      data: { id: randomUUID(), ...base },
    });

    const message = await expectRejection(() =>
      prisma.idempotencyRecord.create({
        data: { id: randomUUID(), ...base },
      }),
    );

    expect(message).toMatch(/user_id|idempotency_key/);
  });
});

describe('C-10 una orden activa por activo', () => {
  it('rechaza una segunda orden activa y la permite tras cerrar la primera', async () => {
    const sent1 = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      assetSequence: 2,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });
    const sent2 = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      assetSequence: 3,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });
    const sent3 = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      assetSequence: 4,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });

    const firstOrder = await createOrder(fixtures, {
      sentMovementId: sent1,
      status: 'ABIERTA',
    });

    const message = await expectRejection(() =>
      createOrder(fixtures, { sentMovementId: sent2, status: 'EN_PROVEEDOR' }),
    );
    expect(message).toMatch(/active_key/);

    await prisma.maintenanceOrder.update({
      where: { id: firstOrder },
      data: {
        status: 'CERRADA',
        closedAt: new Date('2026-02-10T15:00:00.000Z'),
      },
    });

    const secondOrder = await createOrder(fixtures, {
      sentMovementId: sent3,
      status: 'ABIERTA',
    });
    expect(secondOrder).toBeDefined();
  });
});

describe('C-11 next_due_date posterior al evento', () => {
  it('rechaza un servicio con vencimiento igual o anterior', async () => {
    const message = await expectRejection(() =>
      prisma.maintenanceService.create({
        data: {
          id: randomUUID(),
          extinguisherId: fixtures.extinguisherId,
          serviceType: 'MANTENIMIENTO',
          performedAt: new Date('2026-01-10T15:00:00.000Z'),
          performedOn: new Date('2026-01-10T00:00:00.000Z'),
          result: 'APROBADO',
          nextDueDate: new Date('2026-01-10T00:00:00.000Z'),
          createdById: fixtures.userId,
        },
      }),
    );

    expect(message).toMatch(/maintenance_services_next_due_chk/);
  });

  it('rechaza una inspección con vencimiento anterior', async () => {
    const message = await expectRejection(() =>
      prisma.inspection.create({
        data: {
          id: randomUUID(),
          extinguisherId: fixtures.extinguisherId,
          inspectedAt: new Date('2026-01-10T15:00:00.000Z'),
          inspectedOn: new Date('2026-01-10T00:00:00.000Z'),
          inspectorName: 'Inspector de pruebas',
          result: 'APROBADO',
          nextDueDate: new Date('2026-01-09T00:00:00.000Z'),
          createdById: fixtures.userId,
        },
      }),
    );

    expect(message).toMatch(/inspections_next_due_chk/);
  });
});

describe('C-12 days_before', () => {
  it('rechaza un umbral negativo', async () => {
    const message = await expectRejection(() =>
      prisma.alertSetting.create({
        data: {
          id: randomUUID(),
          eventType: 'EQUIPO',
          daysBefore: -1,
          updatedById: fixtures.userId,
        },
      }),
    );

    expect(message).toMatch(/alert_settings_days_before_chk/);
  });
});

describe('C-13 una fecha objetivo por activo y categoría', () => {
  it('rechaza dos filas con el mismo evento', async () => {
    const base = {
      extinguisherId: fixtures.extinguisherId,
      eventType: 'INSPECCION' as const,
      dueDate: new Date('2027-01-01T00:00:00.000Z'),
      sourceType: 'INSPECTION' as const,
      sourceId: randomUUID(),
    };

    await prisma.dueDate.create({ data: { id: randomUUID(), ...base } });

    const message = await expectRejection(() =>
      prisma.dueDate.create({ data: { id: randomUUID(), ...base } }),
    );

    expect(message).toMatch(/extinguisher_id|event_type/);
  });
});

describe('C-14 movimientos de envío y retorno únicos', () => {
  it('rechaza dos órdenes con el mismo movimiento de envío', async () => {
    const other = await createExtinguisher(fixtures);
    const sent = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });
    const sentOther = await createMovement(fixtures, {
      extinguisherId: other.id,
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });

    await createOrder(fixtures, {
      sentMovementId: sent,
      status: 'CERRADA',
      closedAt: new Date('2026-02-10T15:00:00.000Z'),
    });

    const message = await expectRejection(() =>
      createOrder(fixtures, {
        extinguisherId: other.id,
        sentMovementId: sent,
        status: 'CERRADA',
        closedAt: new Date('2026-02-11T15:00:00.000Z'),
      }),
    );
    expect(message).toMatch(/sent_movement_id/);

    const valid = await createOrder(fixtures, {
      extinguisherId: other.id,
      sentMovementId: sentOther,
      status: 'CERRADA',
      closedAt: new Date('2026-02-11T15:00:00.000Z'),
    });
    expect(valid).toBeDefined();
  });

  it('rechaza dos órdenes con el mismo movimiento de retorno', async () => {
    const other = await createExtinguisher(fixtures);
    const sent1 = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });
    const sent2 = await createMovement(fixtures, {
      extinguisherId: other.id,
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });
    const returned = await createMovement(fixtures, {
      movementType: 'RETORNO_MANTENIMIENTO',
      entrySource: null,
      assetSequence: 2,
      originKind: 'EXTERNAL_PARTY',
      originExternalPartyId: fixtures.providerId,
      destinationKind: 'LOCATION',
      destinationLocationId: fixtures.warehouseId,
    });

    await createOrder(fixtures, {
      sentMovementId: sent1,
      returnMovementId: returned,
      status: 'CERRADA',
      closedAt: new Date('2026-02-10T15:00:00.000Z'),
    });

    const message = await expectRejection(() =>
      createOrder(fixtures, {
        extinguisherId: other.id,
        sentMovementId: sent2,
        returnMovementId: returned,
        status: 'CERRADA',
        closedAt: new Date('2026-02-11T15:00:00.000Z'),
      }),
    );

    expect(message).toMatch(/return_movement_id/);
  });
});

describe('C-15 orden interna o externa, no ambas', () => {
  it('rechaza una orden con proveedor y taller a la vez', async () => {
    const sent = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });

    const message = await expectRejection(() =>
      createOrder(fixtures, {
        sentMovementId: sent,
        providerId: fixtures.providerId,
        workshopLocationId: fixtures.workshopId,
      }),
    );

    expect(message).toMatch(/maintenance_orders_party_chk/);
  });

  it('rechaza una orden sin proveedor ni taller', async () => {
    const sent = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'EXTERNAL_PARTY',
      destinationLocationId: null,
      destinationExternalPartyId: fixtures.providerId,
    });

    const message = await expectRejection(() =>
      createOrder(fixtures, {
        sentMovementId: sent,
        providerId: null,
        workshopLocationId: null,
      }),
    );

    expect(message).toMatch(/maintenance_orders_party_chk/);
  });

  it('acepta una orden interna con taller', async () => {
    const sent = await createMovement(fixtures, {
      movementType: 'ENVIO_MANTENIMIENTO',
      entrySource: null,
      originKind: 'LOCATION',
      originLocationId: fixtures.warehouseId,
      destinationKind: 'LOCATION',
      destinationLocationId: fixtures.workshopId,
    });

    const id = await createOrder(fixtures, {
      sentMovementId: sent,
      providerId: null,
      workshopLocationId: fixtures.workshopId,
    });

    expect(id).toBeDefined();
  });
});

describe('C-17 nombre único dentro de la sede', () => {
  it('rechaza dos hijas con el mismo nombre en la misma sede', async () => {
    await prisma.location.create({
      data: {
        id: randomUUID(),
        code: `UBI-${randomUUID().slice(0, 8)}`,
        name: 'Área repetida',
        type: 'AREA',
        parentId: fixtures.sedeId,
        createdById: fixtures.userId,
      },
    });

    const message = await expectRejection(() =>
      prisma.location.create({
        data: {
          id: randomUUID(),
          code: `UBI-${randomUUID().slice(0, 8)}`,
          name: 'Área repetida',
          type: 'AREA',
          parentId: fixtures.sedeId,
          createdById: fixtures.userId,
        },
      }),
    );

    expect(message).toMatch(/parent_id|name/);
  });

  it('permite el mismo nombre en sedes distintas', async () => {
    const otherSede = randomUUID();
    await prisma.location.create({
      data: {
        id: otherSede,
        code: `UBI-${otherSede.slice(0, 8)}`,
        name: 'Otra sede',
        type: 'SEDE',
        createdById: fixtures.userId,
      },
    });

    await prisma.location.create({
      data: {
        id: randomUUID(),
        code: `UBI-${randomUUID().slice(0, 8)}`,
        name: 'Área compartida',
        type: 'AREA',
        parentId: fixtures.sedeId,
        createdById: fixtures.userId,
      },
    });

    const created = await prisma.location.create({
      data: {
        id: randomUUID(),
        code: `UBI-${randomUUID().slice(0, 8)}`,
        name: 'Área compartida',
        type: 'AREA',
        parentId: otherSede,
        createdById: fixtures.userId,
      },
    });

    expect(created.id).toBeDefined();
  });
});

describe('C-18 y C-19 costo y moneda', () => {
  const baseService = () => ({
    id: randomUUID(),
    extinguisherId: fixtures.extinguisherId,
    serviceType: 'MANTENIMIENTO' as const,
    performedAt: new Date('2026-01-10T15:00:00.000Z'),
    performedOn: new Date('2026-01-10T00:00:00.000Z'),
    result: 'APROBADO' as const,
    createdById: fixtures.userId,
  });

  it('rechaza un costo negativo', async () => {
    const message = await expectRejection(() =>
      prisma.maintenanceService.create({
        data: { ...baseService(), cost: '-1.00', currency: 'PEN' },
      }),
    );

    expect(message).toMatch(/maintenance_services_cost_chk/);
  });

  it('rechaza costo sin moneda y moneda sin costo', async () => {
    const costWithoutCurrency = await expectRejection(() =>
      prisma.maintenanceService.create({
        data: { ...baseService(), cost: '10.00', currency: null },
      }),
    );
    const currencyWithoutCost = await expectRejection(() =>
      prisma.maintenanceService.create({
        data: { ...baseService(), cost: null, currency: 'PEN' },
      }),
    );

    expect(costWithoutCurrency).toMatch(/maintenance_services_currency_chk/);
    expect(currencyWithoutCost).toMatch(/maintenance_services_currency_chk/);
  });

  it('acepta costo y moneda juntos', async () => {
    const created = await prisma.maintenanceService.create({
      data: { ...baseService(), cost: '10.00', currency: 'PEN' },
    });

    expect(created.id).toBeDefined();
  });
});
