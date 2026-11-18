import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AuditService } from '../src/modules/audit/audit.service';
import { createTestApp } from './e2e-app';
import { AuthFixtures, TEST_PASSWORD, seedAuthFixtures } from './e2e-fixtures';
import { prisma, resetDatabase } from './integration/test-db';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string | null;
  };
}

interface ExtinguisherBody {
  id: string;
  assetCode: string;
  logisticsStatus: string;
  technicalCondition: string;
  placementType: string;
  currentLocation: { id: string; name: string; type: string } | null;
  currentExternalParty: { id: string } | null;
  retiredAt: string | null;
  rowVersion: number;
}

interface AltaBody {
  id: string;
  assetCode: string;
  extinguisher: ExtinguisherBody;
  movement: {
    id: string;
    type: string;
    assetSequence: number;
    movedAt: string;
  };
}

interface MovementView {
  id: string;
  extinguisher: { id: string; assetCode: string };
  assetSequence: number;
  type: string;
  origin: { kind: string; locationId: string | null; label: string };
  destination: {
    kind: string;
    locationId: string | null;
    externalPartyId: string | null;
    label: string;
  };
  movedAt: string;
  requestedBy: string | null;
  authorizedBy: string | null;
  deliveredBy: string | null;
  receivedBy: string | null;
  reason: string;
  documentRef: string | null;
  correctsMovementId: string | null;
}

interface OperationBody {
  movement: MovementView;
  extinguisher: ExtinguisherBody;
}

interface ListBody {
  data: MovementView[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface Catalog {
  typeId: string;
  sedeId: string;
  warehouseA: string;
  warehouseB: string;
  areaA: string;
  areaB: string;
  workshopId: string;
  providerId: string;
}

describe('Movimientos (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let adminToken: string;
  let consultaToken: string;
  let almacenToken: string;
  let seguridadToken: string;
  let catalog: Catalog;

  const authenticate = async (email: string): Promise<string> => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  };

  const altaPayload = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    serialNumber: `SN-${randomUUID().slice(0, 8)}`,
    typeId: catalog.typeId,
    brand: 'ACME',
    model: 'PQS-6',
    capacityValue: 6,
    capacityUnit: 'KG',
    manufactureDate: '2020-01-01',
    acquiredAt: '2020-02-01',
    commissionedAt: '2020-02-10',
    manufacturerExpiryDate: '2035-01-01',
    initialLocationId: catalog.warehouseA,
    entrySource: 'COMPRA_CENTRAL',
    initialReason: 'Compra central para el almacén',
    receivedBy: 'Carlos Ruiz',
    documentRef: 'FACTURA-2020-001',
    technicalCondition: 'OPERATIVO',
    ...overrides,
  });

  const createExtinguisher = async (
    overrides: Record<string, unknown> = {},
  ): Promise<AltaBody> => {
    const response = await request(server)
      .post('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', randomUUID())
      .send(altaPayload(overrides))
      .expect(201);
    return response.body as AltaBody;
  };

  const at = (created: AltaBody, seconds: number): string =>
    new Date(
      new Date(created.movement.movedAt).getTime() + seconds * 1000,
    ).toISOString();

  const movementPayload = (
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    type: 'SALIDA',
    originLocationId: catalog.warehouseA,
    destinationLocationId: catalog.areaA,
    movedAt: at(created, 1),
    requestedBy: 'Juan Pérez',
    deliveredBy: 'Juan Pérez',
    receivedBy: 'Carlos Ruiz',
    reason: 'Instalación en el área de producción',
    documentRef: 'ACTA-2026-001',
    rowVersion: created.extinguisher.rowVersion,
    ...overrides,
  });

  const retirePayload = (
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    movedAt: at(created, 1),
    authorizedBy: 'María López',
    reason: 'Equipo fuera de servicio definitivo',
    documentRef: 'ACTA-BAJA-2026-001',
    rowVersion: created.extinguisher.rowVersion,
    ...overrides,
  });

  const adjustPayload = (
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    placementType: 'INTERNAL',
    locationId: catalog.warehouseB,
    movedAt: at(created, 2),
    authorizedBy: 'María López',
    reason: 'Corrección de ubicación registrada por error',
    documentRef: 'ACTA-AJUSTE-2026-001',
    rowVersion: created.extinguisher.rowVersion,
    ...overrides,
  });

  const postMovement = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/movements`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const postRetire = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/retire`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const postAdjust = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const storedAsset = (id: string) =>
    prisma.extinguisher.findUniqueOrThrow({ where: { id } });

  const movementsOf = (id: string) =>
    prisma.movement.findMany({
      where: { extinguisherId: id },
      orderBy: { assetSequence: 'asc' },
    });

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    adminToken = await authenticate(fixtures.admin.email);
    consultaToken = await authenticate(fixtures.consulta.email);
    almacenToken = await authenticate(fixtures.almacen.email);
    seguridadToken = await authenticate(fixtures.seguridad.email);

    const typeId = randomUUID();
    await prisma.extinguisherType.create({
      data: {
        id: typeId,
        code: 'PQS-6KG',
        name: 'PQS 6 kg',
        agent: 'PQS',
        nominalCapacity: '6.00',
        capacityUnit: 'KG',
        usefulLifeYears: 10,
      },
    });

    const sedeId = randomUUID();
    await prisma.location.create({
      data: {
        id: sedeId,
        code: 'UBI-000001',
        name: 'Sede Central',
        type: 'SEDE',
        createdById: fixtures.admin.id,
      },
    });

    const createLocation = async (
      name: string,
      type: 'ALMACEN' | 'AREA' | 'TALLER',
    ): Promise<string> => {
      const id = randomUUID();
      await prisma.location.create({
        data: {
          id,
          code: `UBI-${id.slice(0, 8)}`,
          name,
          type,
          parentId: sedeId,
          createdById: fixtures.admin.id,
        },
      });
      return id;
    };

    const warehouseA = await createLocation('Almacén Central', 'ALMACEN');
    const warehouseB = await createLocation('Almacén Norte', 'ALMACEN');
    const areaA = await createLocation('Área de producción', 'AREA');
    const areaB = await createLocation('Área de despacho', 'AREA');
    const workshopId = await createLocation('Taller propio', 'TALLER');

    const providerId = randomUUID();
    await prisma.externalParty.create({
      data: {
        id: providerId,
        code: 'PRV-0001',
        name: 'Proveedor de mantenimiento',
        partyType: 'PROVEEDOR_MANTENIMIENTO',
        active: true,
      },
    });

    catalog = {
      typeId,
      sedeId,
      warehouseA,
      warehouseB,
      areaA,
      areaB,
      workshopId,
      providerId,
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-MOV-01: SALIDA desde el almacén correcto actualiza estado e historial', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.movement.type).toBe('SALIDA');
    expect(body.movement.assetSequence).toBe(2);
    expect(body.movement.origin).toMatchObject({
      kind: 'LOCATION',
      locationId: catalog.warehouseA,
    });
    expect(body.movement.destination).toMatchObject({
      kind: 'LOCATION',
      locationId: catalog.areaA,
    });
    expect(body.movement.requestedBy).toBe('Juan Pérez');
    expect(body.extinguisher.logisticsStatus).toBe('ASIGNADO');
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.areaA);
    expect(body.extinguisher.rowVersion).toBe(
      created.extinguisher.rowVersion + 1,
    );

    const stored = await storedAsset(created.id);
    expect(stored.logisticsStatus).toBe('ASIGNADO');
    expect(stored.currentLocationId).toBe(catalog.areaA);
    expect(stored.currentSince?.toISOString()).toBe(body.movement.movedAt);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'MOVEMENT_CREATED', entityId: body.movement.id },
    });
    expect(audit).not.toBeNull();
  });

  it('T-MOV-02: rechaza un origen distinto de la ubicación actual', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, { originLocationId: catalog.warehouseB }),
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe('ORIGIN_MISMATCH');
    expect(
      await prisma.movement.count({ where: { extinguisherId: created.id } }),
    ).toBe(1);
    const stored = await storedAsset(created.id);
    expect(stored.logisticsStatus).toBe('EN_ALMACEN');
    expect(stored.rowVersion).toBe(created.extinguisher.rowVersion);
  });

  it('T-MOV-03: SALIDA hacia un almacén se rechaza con DESTINATION_INVALID', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, { destinationLocationId: catalog.warehouseB }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('DESTINATION_INVALID');
  });

  it('T-MOV-04: TRASLADO entre áreas conserva ASIGNADO', async () => {
    const created = await createExtinguisher();
    const salida = (
      await postMovement(
        almacenToken,
        created.id,
        movementPayload(created),
      ).expect(201)
    ).body as OperationBody;

    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        type: 'TRASLADO',
        originLocationId: catalog.areaA,
        destinationLocationId: catalog.areaB,
        movedAt: at(created, 2),
        rowVersion: salida.extinguisher.rowVersion,
      }),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.movement.assetSequence).toBe(3);
    expect(body.extinguisher.logisticsStatus).toBe('ASIGNADO');
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.areaB);
  });

  it('T-MOV-05: TRASLADO entre almacenes conserva EN_ALMACEN', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        type: 'TRASLADO',
        destinationLocationId: catalog.warehouseB,
      }),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.warehouseB);
  });

  it('T-MOV-06: RETORNO_ALMACEN desde un área', async () => {
    const created = await createExtinguisher();
    const salida = (
      await postMovement(
        almacenToken,
        created.id,
        movementPayload(created),
      ).expect(201)
    ).body as OperationBody;

    const response = await postMovement(almacenToken, created.id, {
      type: 'RETORNO_ALMACEN',
      originLocationId: catalog.areaA,
      destinationLocationId: catalog.warehouseB,
      movedAt: at(created, 2),
      deliveredBy: 'Juan Pérez',
      receivedBy: 'Carlos Ruiz',
      reason: 'Retorno al almacén norte',
      rowVersion: salida.extinguisher.rowVersion,
    }).expect(201);
    const body = response.body as OperationBody;

    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.warehouseB);
    expect(body.movement.requestedBy).toBeNull();
  });

  it('T-MOV-07: rechaza movimientos de un activo en mantenimiento', async () => {
    const created = await createExtinguisher();
    await prisma.extinguisher.update({
      where: { id: created.id },
      data: { logisticsStatus: 'EN_MANTENIMIENTO' },
    });

    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe('INVALID_TRANSITION');
  });

  it('T-MOV-08 / T-MOV-23: rechaza movimientos de un activo dado de baja', async () => {
    const created = await createExtinguisher();
    await prisma.extinguisher.update({
      where: { id: created.id },
      data: {
        logisticsStatus: 'DADO_DE_BAJA',
        placementType: 'NONE',
        currentLocationId: null,
        retiredAt: new Date(),
        retirementReason: 'Baja registrada directamente para la prueba',
      },
    });

    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe('ASSET_RETIRED');
  });

  it('T-MOV-09: exige receivedBy en SALIDA', async () => {
    const created = await createExtinguisher();
    const payload = movementPayload(created);
    delete payload.receivedBy;

    const response = await postMovement(
      almacenToken,
      created.id,
      payload,
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(
      await prisma.movement.count({ where: { extinguisherId: created.id } }),
    ).toBe(1);
  });

  it('T-MOV-10: exige motivo con longitud mínima', async () => {
    const created = await createExtinguisher();
    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, { reason: 'abc' }),
    ).expect(422);
  });

  it('T-MOV-11: rechaza una fecha futura más allá de la tolerancia', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        movedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('DATE_IN_FUTURE');
  });

  it('T-MOV-12: rechaza una fecha anterior al último movimiento', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        movedAt: new Date(
          new Date(created.movement.movedAt).getTime() - 1000,
        ).toISOString(),
      }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('DATE_BEFORE_EVENT');
  });

  it('T-MOV-13: la misma Idempotency-Key devuelve el mismo movimiento', async () => {
    const created = await createExtinguisher();
    const key = randomUUID();
    const first = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
      key,
    ).expect(201);
    const replay = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
      key,
    ).expect(200);

    expect(replay.headers['idempotent-replay']).toBe('true');
    expect((replay.body as OperationBody).movement.id).toBe(
      (first.body as OperationBody).movement.id,
    );
    expect(
      await prisma.movement.count({ where: { extinguisherId: created.id } }),
    ).toBe(2);
  });

  it('T-MOV-14: la misma clave con otro payload devuelve 409', async () => {
    const created = await createExtinguisher();
    const key = randomUUID();
    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
      key,
    ).expect(201);

    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        destinationLocationId: catalog.areaB,
        movedAt: at(created, 2),
      }),
      key,
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('T-MOV-15: dos salidas concurrentes no duplican secuencia ni estado', async () => {
    const created = await createExtinguisher();
    const payload = movementPayload(created);
    const [first, second] = await Promise.all([
      postMovement(almacenToken, created.id, payload),
      postMovement(almacenToken, created.id, payload),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const movements = await movementsOf(created.id);
    expect(movements.map((movement) => movement.assetSequence)).toEqual([1, 2]);
    const stored = await storedAsset(created.id);
    expect(stored.logisticsStatus).toBe('ASIGNADO');
    expect(stored.rowVersion).toBe(created.extinguisher.rowVersion + 1);
  });

  it('T-MOV-16/17: si falla la auditoría, no queda movimiento ni cambio de estado', async () => {
    const created = await createExtinguisher();
    const key = randomUUID();
    const audit = app.get(AuditService);
    const spy = jest
      .spyOn(audit, 'record')
      .mockRejectedValueOnce(new Error('fallo simulado'));

    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
      key,
    ).expect(500);
    spy.mockRestore();

    expect((response.body as ErrorBody).error.code).toBe('INTERNAL_ERROR');
    expect(
      await prisma.movement.count({ where: { extinguisherId: created.id } }),
    ).toBe(1);
    const stored = await storedAsset(created.id);
    expect(stored.logisticsStatus).toBe('EN_ALMACEN');
    expect(stored.currentLocationId).toBe(catalog.warehouseA);
    expect(stored.rowVersion).toBe(created.extinguisher.rowVersion);

    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
      key,
    ).expect(201);
  });

  it('T-MOV-18: el historial conserva el snapshot al renombrar la ubicación', async () => {
    const created = await createExtinguisher();
    const body = (
      await postMovement(
        almacenToken,
        created.id,
        movementPayload(created),
      ).expect(201)
    ).body as OperationBody;

    await prisma.location.update({
      where: { id: catalog.areaA },
      data: { name: 'Área de producción renombrada' },
    });

    const movement = await request(server)
      .get(`/api/v1/movements/${body.movement.id}`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    expect((movement.body as MovementView).destination.label).toContain(
      'Área de producción',
    );
    expect((movement.body as MovementView).destination.label).not.toContain(
      'renombrada',
    );

    const extinguisher = await request(server)
      .get(`/api/v1/extinguishers/${created.id}`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    expect((extinguisher.body as ExtinguisherBody).currentLocation?.name).toBe(
      'Área de producción renombrada',
    );
  });

  it('T-MOV-19: ALMACEN no puede registrar ajustes', async () => {
    const created = await createExtinguisher();
    await postAdjust(almacenToken, created.id, adjustPayload(created)).expect(
      403,
    );
  });

  it('T-MOV-20: AJUSTE de ADMIN corrige la proyección sin borrar el original', async () => {
    const created = await createExtinguisher();
    const salida = (
      await postMovement(
        almacenToken,
        created.id,
        movementPayload(created),
      ).expect(201)
    ).body as OperationBody;

    const response = await postAdjust(
      adminToken,
      created.id,
      adjustPayload(created, {
        rowVersion: salida.extinguisher.rowVersion,
      }),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.movement.type).toBe('AJUSTE');
    expect(body.movement.assetSequence).toBe(3);
    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.warehouseB);

    const movements = await movementsOf(created.id);
    expect(movements.map((movement) => movement.movementType)).toEqual([
      'INGRESO',
      'SALIDA',
      'AJUSTE',
    ]);
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'MOVEMENT_ADJUSTED', entityId: body.movement.id },
    });
    expect(audit).not.toBeNull();
  });

  it('T-MOV-21: BAJA deja el activo fuera de operación y conserva el historial', async () => {
    const created = await createExtinguisher();
    const response = await postRetire(
      seguridadToken,
      created.id,
      retirePayload(created),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.movement.type).toBe('BAJA');
    expect(body.movement.destination.kind).toBe('NONE');
    expect(body.extinguisher.logisticsStatus).toBe('DADO_DE_BAJA');
    expect(body.extinguisher.placementType).toBe('NONE');
    expect(body.extinguisher.currentLocation).toBeNull();
    expect(body.extinguisher.retiredAt).not.toBeNull();

    const stored = await storedAsset(created.id);
    expect(stored.retirementReason).toBe('Equipo fuera de servicio definitivo');
    expect(
      await prisma.movement.count({ where: { extinguisherId: created.id } }),
    ).toBe(2);

    const list = await request(server)
      .get('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    expect((list.body as { data: ExtinguisherBody[] }).data).toHaveLength(0);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'EXTINGUISHER_RETIRED', entityId: created.id },
    });
    expect(audit).not.toBeNull();
  });

  it('T-MOV-22: BAJA con orden de mantenimiento activa se rechaza', async () => {
    const created = await createExtinguisher();
    await prisma.maintenanceOrder.create({
      data: {
        id: randomUUID(),
        extinguisherId: created.id,
        providerId: catalog.providerId,
        status: 'ABIERTA',
        sentMovementId: created.movement.id,
        openedAt: new Date(created.movement.movedAt),
        reason: 'Mantenimiento programado',
        createdById: fixtures.admin.id,
      },
    });

    const response = await postRetire(
      seguridadToken,
      created.id,
      retirePayload(created),
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe(
      'MAINTENANCE_ORDER_ACTIVE',
    );
  });

  it('T-MOV-24: historial paginado, ordenado y con filtros', async () => {
    const created = await createExtinguisher();
    const salida = (
      await postMovement(
        almacenToken,
        created.id,
        movementPayload(created),
      ).expect(201)
    ).body as OperationBody;
    const retorno = (
      await postMovement(almacenToken, created.id, {
        type: 'RETORNO_ALMACEN',
        originLocationId: catalog.areaA,
        destinationLocationId: catalog.warehouseA,
        movedAt: at(created, 2),
        deliveredBy: 'Juan Pérez',
        receivedBy: 'Carlos Ruiz',
        reason: 'Retorno al almacén central',
        rowVersion: salida.extinguisher.rowVersion,
      }).expect(201)
    ).body as OperationBody;
    await postMovement(almacenToken, created.id, {
      type: 'TRASLADO',
      originLocationId: catalog.warehouseA,
      destinationLocationId: catalog.warehouseB,
      movedAt: at(created, 3),
      requestedBy: 'Juan Pérez',
      deliveredBy: 'Juan Pérez',
      receivedBy: 'Carlos Ruiz',
      reason: 'Traslado al almacén norte',
      rowVersion: retorno.extinguisher.rowVersion,
    }).expect(201);

    const firstPage = await request(server)
      .get(`/api/v1/extinguishers/${created.id}/movements?page=1&pageSize=2`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    const firstBody = firstPage.body as ListBody;
    expect(firstBody.meta).toMatchObject({ total: 4, totalPages: 2 });
    expect(firstBody.data.map((movement) => movement.assetSequence)).toEqual([
      4, 3,
    ]);

    const secondPage = await request(server)
      .get(`/api/v1/extinguishers/${created.id}/movements?page=2&pageSize=2`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    expect(
      (secondPage.body as ListBody).data.map(
        (movement) => movement.assetSequence,
      ),
    ).toEqual([2, 1]);

    const filtered = await request(server)
      .get(
        `/api/v1/movements?type=SALIDA&locationId=${catalog.warehouseA}&pageSize=100`,
      )
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    expect((filtered.body as ListBody).data).toHaveLength(1);
    expect((filtered.body as ListBody).data[0]?.type).toBe('SALIDA');

    const byCode = await request(server)
      .get(`/api/v1/movements?assetCode=${created.assetCode}`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    expect((byCode.body as ListBody).meta.total).toBe(4);
  });

  it('T-MOV-25/26: NO_OPERATIVO no va a área, pero sí a almacén', async () => {
    const created = await createExtinguisher({
      technicalCondition: 'NO_OPERATIVO',
    });

    const rejected = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
    ).expect(422);
    expect((rejected.body as ErrorBody).error.code).toBe(
      'CONDITION_NOT_ASSIGNABLE',
    );

    const allowed = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        type: 'TRASLADO',
        destinationLocationId: catalog.warehouseB,
      }),
    ).expect(201);
    expect((allowed.body as OperationBody).extinguisher.logisticsStatus).toBe(
      'EN_ALMACEN',
    );
  });

  it('T-MOV-27: no se puede marcar NO_OPERATIVO un equipo asignado a un área', async () => {
    const created = await createExtinguisher();
    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created),
    ).expect(201);

    const response = await request(server)
      .post(`/api/v1/extinguishers/${created.id}/condition`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .send({
        condition: 'NO_OPERATIVO',
        reason: 'Equipo con falla detectada en inspección',
      })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe(
      'CONDITION_NOT_ASSIGNABLE',
    );
  });

  it('T-MOV-28/29/30: BAJA exige permiso, autorización y documento', async () => {
    const created = await createExtinguisher();
    await postRetire(almacenToken, created.id, retirePayload(created)).expect(
      403,
    );

    const missingDocument = retirePayload(created);
    delete missingDocument.documentRef;
    await postRetire(seguridadToken, created.id, missingDocument).expect(422);

    const missingAuthorization = retirePayload(created);
    delete missingAuthorization.authorizedBy;
    await postRetire(seguridadToken, created.id, missingAuthorization).expect(
      422,
    );

    expect(
      await prisma.movement.count({ where: { extinguisherId: created.id } }),
    ).toBe(1);
  });

  it('T-MOV-31: AJUSTE exige documentRef', async () => {
    const created = await createExtinguisher();
    const payload = adjustPayload(created);
    delete payload.documentRef;

    const response = await postAdjust(adminToken, created.id, payload).expect(
      422,
    );
    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('T-MOV-32/33/36: rechaza adjuntos, batchId y documentRef demasiado largo', async () => {
    const created = await createExtinguisher();

    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, { attachments: ['acta.pdf'] }),
    ).expect(422);

    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, { batchId: randomUUID() }),
    ).expect(422);

    await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, { documentRef: 'D'.repeat(101) }),
    ).expect(422);
  });

  it('T-MOV-34/35: la selección múltiple se resuelve activo por activo', async () => {
    const first = await createExtinguisher();
    const second = await createExtinguisher();
    const wrongOrigin = await createExtinguisher({
      initialLocationId: catalog.warehouseB,
    });

    const results = await Promise.all([
      postMovement(almacenToken, first.id, movementPayload(first)),
      postMovement(almacenToken, second.id, movementPayload(second)),
      postMovement(almacenToken, wrongOrigin.id, movementPayload(wrongOrigin)),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      201, 201, 409,
    ]);
    expect((results[2]?.body as ErrorBody).error.code).toBe('ORIGIN_MISMATCH');
    expect(
      await prisma.movement.count({
        where: { movementType: 'SALIDA' },
      }),
    ).toBe(2);
  });

  it('T-MOV-37: AJUSTE reactiva una baja indicando el movimiento corregido', async () => {
    const created = await createExtinguisher();
    const baja = (
      await postRetire(
        seguridadToken,
        created.id,
        retirePayload(created),
      ).expect(201)
    ).body as OperationBody;

    const response = await postAdjust(
      adminToken,
      created.id,
      adjustPayload(created, {
        movedAt: at(created, 2),
        rowVersion: baja.extinguisher.rowVersion,
        correctsMovementId: baja.movement.id,
      }),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.retiredAt).toBeNull();
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.warehouseB);
    expect(body.movement.correctsMovementId).toBe(baja.movement.id);

    const stored = await storedAsset(created.id);
    expect(stored.retirementReason).toBeNull();
  });

  it('T-MOV-38: reactivar sin el movimiento de baja o con uno distinto falla', async () => {
    const created = await createExtinguisher();
    const baja = (
      await postRetire(
        seguridadToken,
        created.id,
        retirePayload(created),
      ).expect(201)
    ).body as OperationBody;

    const withoutReference = await postAdjust(
      adminToken,
      created.id,
      adjustPayload(created, {
        rowVersion: baja.extinguisher.rowVersion,
      }),
    ).expect(422);
    expect((withoutReference.body as ErrorBody).error.code).toBe(
      'VALIDATION_ERROR',
    );

    const wrongReference = await postAdjust(
      adminToken,
      created.id,
      adjustPayload(created, {
        rowVersion: baja.extinguisher.rowVersion,
        correctsMovementId: created.movement.id,
      }),
    ).expect(422);
    expect((wrongReference.body as ErrorBody).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('T-MOV-39: AJUSTE a entidad externa deja el equipo en mantenimiento', async () => {
    const created = await createExtinguisher();
    const response = await postAdjust(
      adminToken,
      created.id,
      adjustPayload(created, {
        placementType: 'EXTERNAL',
        locationId: undefined,
        externalPartyId: catalog.providerId,
      }),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.extinguisher.logisticsStatus).toBe('EN_MANTENIMIENTO');
    expect(body.extinguisher.placementType).toBe('EXTERNAL');
    expect(body.extinguisher.currentExternalParty?.id).toBe(catalog.providerId);

    const blocked = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        movedAt: at(created, 3),
        rowVersion: body.extinguisher.rowVersion,
      }),
    ).expect(409);
    expect((blocked.body as ErrorBody).error.code).toBe('INVALID_TRANSITION');
  });

  it('T-MOV-40: AJUSTE sin cambio real de colocación se rechaza', async () => {
    const created = await createExtinguisher();
    const response = await postAdjust(
      adminToken,
      created.id,
      adjustPayload(created, { locationId: catalog.warehouseA }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('DESTINATION_INVALID');
  });

  it('T-MOV-41: TALLER queda reservado para mantenimiento', async () => {
    const created = await createExtinguisher();
    const response = await postMovement(
      almacenToken,
      created.id,
      movementPayload(created, {
        type: 'TRASLADO',
        destinationLocationId: catalog.workshopId,
      }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('DESTINATION_INVALID');
  });

  it('T-MOV-42: exige Idempotency-Key y permisos de lectura', async () => {
    const created = await createExtinguisher();

    const missingKey = await request(server)
      .post(`/api/v1/extinguishers/${created.id}/movements`)
      .set('Authorization', `Bearer ${almacenToken}`)
      .send(movementPayload(created))
      .expect(422);
    expect((missingKey.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const forbidden = await postMovement(
      consultaToken,
      created.id,
      movementPayload(created),
    ).expect(403);
    expect((forbidden.body as ErrorBody).error.code).toBe('FORBIDDEN');

    await request(server)
      .get(`/api/v1/extinguishers/${created.id}/movements`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
  });
});
