import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
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
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  logisticsStatus: string;
  technicalCondition: string;
  currentLocation: { id: string; type: string } | null;
  rowVersion: number;
  dueDates: Array<{ eventType: string; dueDate: string }>;
}

interface AltaBody {
  id: string;
  assetCode: string;
  qrPayload: string;
  extinguisher: ExtinguisherBody;
  movement: {
    id: string;
    type: string;
    assetSequence: number;
    movedAt: string;
  };
}

interface Catalog {
  typeId: string;
  sedeId: string;
  warehouseId: string;
  areaId: string;
}

describe('Extintores (e2e)', () => {
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

  const postAlta = (
    token: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const altaPayload = (
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    serialNumber: 'SN-2025-001',
    typeId: catalog.typeId,
    brand: 'ACME',
    model: 'PQS-6',
    capacityValue: 6,
    capacityUnit: 'KG',
    manufactureDate: '2020-01-01',
    acquiredAt: '2020-02-01',
    commissionedAt: '2020-02-10',
    manufacturerExpiryDate: '2035-01-01',
    initialLocationId: catalog.warehouseId,
    entrySource: 'COMPRA_CENTRAL',
    initialReason: 'Compra central para el almacén',
    receivedBy: 'Carlos Ruiz',
    documentRef: 'FACTURA-2020-001',
    technicalCondition: 'OPERATIVO',
    notes: 'Equipo nuevo.',
    ...overrides,
  });

  const createExtinguisher = async (
    overrides: Record<string, unknown> = {},
  ): Promise<AltaBody> => {
    const response = await postAlta(adminToken, altaPayload(overrides)).expect(
      201,
    );
    return response.body as AltaBody;
  };

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
        code: `UBI-${sedeId.slice(0, 8)}`,
        name: 'Sede Central',
        type: 'SEDE',
        createdById: fixtures.admin.id,
      },
    });
    const warehouseId = randomUUID();
    await prisma.location.create({
      data: {
        id: warehouseId,
        code: `UBI-${warehouseId.slice(0, 8)}`,
        name: 'Almacén Central',
        type: 'ALMACEN',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });
    const areaId = randomUUID();
    await prisma.location.create({
      data: {
        id: areaId,
        code: `UBI-${areaId.slice(0, 8)}`,
        name: 'Área de producción',
        type: 'AREA',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });

    catalog = { typeId, sedeId, warehouseId, areaId };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-EXT-01: alta en almacén con INGRESO, fechas EQUIPO y auditoría', async () => {
    const response = await postAlta(adminToken, altaPayload()).expect(201);
    const body = response.body as AltaBody;

    expect(body.assetCode).toMatch(/^EXT-\d{6}$/);
    expect(body.qrPayload).toBe(body.assetCode);
    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.currentLocation?.id).toBe(catalog.warehouseId);
    expect(body.movement).toMatchObject({
      type: 'INGRESO',
      assetSequence: 1,
    });

    const stored = await prisma.extinguisher.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(stored.currentLocationId).toBe(catalog.warehouseId);
    expect(stored.placementType).toBe('INTERNAL');
    expect(stored.currentSince).not.toBeNull();

    const movement = await prisma.movement.findFirstOrThrow({
      where: { extinguisherId: body.id },
    });
    expect(movement.assetSequence).toBe(1);
    expect(movement.movementType).toBe('INGRESO');
    expect(movement.entrySource).toBe('COMPRA_CENTRAL');
    expect(movement.originKind).toBe('NONE');
    expect(movement.destinationLocationId).toBe(catalog.warehouseId);
    expect(movement.receivedBy).toBe('Carlos Ruiz');
    expect(movement.documentRef).toBe('FACTURA-2020-001');

    const dueDate = await prisma.dueDate.findUniqueOrThrow({
      where: {
        extinguisherId_eventType: {
          extinguisherId: body.id,
          eventType: 'EQUIPO',
        },
      },
    });
    expect(dueDate.dueDate.toISOString()).toBe('2030-01-01T00:00:00.000Z');

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'EXTINGUISHER_CREATED', entityId: body.id },
    });
    expect(JSON.stringify(audit.afterData)).toContain(body.assetCode);
  });

  it('T-EXT-02: alta directa en área queda ASIGNADO', async () => {
    const body = await createExtinguisher({
      initialLocationId: catalog.areaId,
      entrySource: 'TRASLADO',
      initialReason: 'Instalación directa en el área',
    });

    expect(body.extinguisher.logisticsStatus).toBe('ASIGNADO');
    expect(body.extinguisher.currentLocation?.type).toBe('AREA');

    const movement = await prisma.movement.findFirstOrThrow({
      where: { extinguisherId: body.id },
    });
    expect(movement.destinationLocationId).toBe(catalog.areaId);
    expect(movement.entrySource).toBe('TRASLADO');
  });

  it('T-EXT-03 / T-CON-03: dos altas simultáneas no colisionan', async () => {
    const [first, second] = await Promise.all([
      postAlta(adminToken, altaPayload()).expect(201),
      postAlta(adminToken, altaPayload()).expect(201),
    ]);

    const firstBody = first.body as AltaBody;
    const secondBody = second.body as AltaBody;
    expect(firstBody.assetCode).not.toBe(secondBody.assetCode);
    expect(await prisma.extinguisher.count()).toBe(2);
    expect(await prisma.movement.count()).toBe(2);
  });

  it('T-EXT-04 / T-EXT-10: el cliente no puede enviar assetCode', async () => {
    const response = await postAlta(
      adminToken,
      altaPayload({ assetCode: 'EXT-999999' }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.extinguisher.count()).toBe(0);
  });

  it('T-EXT-05: PATCH no permite cambiar la ubicación actual', async () => {
    const created = await createExtinguisher();
    const response = await request(server)
      .patch(`/api/v1/extinguishers/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currentLocationId: catalog.areaId,
        rowVersion: created.extinguisher.rowVersion,
      })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    const stored = await prisma.extinguisher.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.currentLocationId).toBe(catalog.warehouseId);
  });

  it('T-EXT-06: PATCH de marca/modelo audita y no toca la ubicación', async () => {
    const created = await createExtinguisher();
    const response = await request(server)
      .patch(`/api/v1/extinguishers/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        brand: 'ACME Actualizada',
        model: 'PQS-6B',
        rowVersion: created.extinguisher.rowVersion,
      })
      .expect(200);
    const body = response.body as ExtinguisherBody;

    expect(body.brand).toBe('ACME Actualizada');
    expect(body.model).toBe('PQS-6B');
    expect(body.rowVersion).toBe(created.extinguisher.rowVersion + 1);
    expect(body.currentLocation?.id).toBe(catalog.warehouseId);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'EXTINGUISHER_UPDATED', entityId: created.id },
    });
    expect(JSON.stringify(audit.beforeData)).toContain('ACME');
    expect(JSON.stringify(audit.afterData)).toContain('ACME Actualizada');
  });

  it('T-EXT-07: cambiar condición sin motivo responde 422', async () => {
    const created = await createExtinguisher();
    const response = await request(server)
      .post(`/api/v1/extinguishers/${created.id}/condition`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .send({ condition: 'OBSERVADO' })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('T-EXT-08 / T-EXT-14: SEGURIDAD cambia la condición con motivo y auditoría', async () => {
    const created = await createExtinguisher();
    const response = await request(server)
      .post(`/api/v1/extinguishers/${created.id}/condition`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .send({
        condition: 'OBSERVADO',
        reason: 'Manómetro fuera de rango',
        rowVersion: created.extinguisher.rowVersion,
      })
      .expect(200);
    const body = response.body as ExtinguisherBody;

    expect(body.technicalCondition).toBe('OBSERVADO');
    expect(body.currentLocation?.id).toBe(catalog.warehouseId);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: {
        action: 'EXTINGUISHER_CONDITION_CHANGED',
        entityId: created.id,
      },
    });
    expect(JSON.stringify(audit.beforeData)).toContain('OPERATIVO');
    expect(JSON.stringify(audit.afterData)).toContain('OBSERVADO');
    expect(JSON.stringify(audit.afterData)).toContain(
      'Manómetro fuera de rango',
    );
  });

  it('T-EXT-13: solo se aceptan los valores del enum de condición', async () => {
    const created = await createExtinguisher();
    const response = await request(server)
      .post(`/api/v1/extinguishers/${created.id}/condition`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .send({ condition: 'EN_REVISION', reason: 'Texto libre no permitido' })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('T-EXT-15: alta en área con NO_OPERATIVO no crea el activo', async () => {
    const response = await postAlta(
      adminToken,
      altaPayload({
        initialLocationId: catalog.areaId,
        technicalCondition: 'NO_OPERATIVO',
      }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe(
      'CONDITION_NOT_ASSIGNABLE',
    );
    expect(await prisma.extinguisher.count()).toBe(0);
    expect(await prisma.movement.count()).toBe(0);
  });

  it('T-EXT-16: alta en almacén con NO_OPERATIVO se permite', async () => {
    const body = await createExtinguisher({
      technicalCondition: 'NO_OPERATIVO',
    });
    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.technicalCondition).toBe('NO_OPERATIVO');
  });

  it('T-EXT-17: alta en área con OBSERVADO se permite', async () => {
    const body = await createExtinguisher({
      initialLocationId: catalog.areaId,
      technicalCondition: 'OBSERVADO',
    });
    expect(body.extinguisher.logisticsStatus).toBe('ASIGNADO');
    expect(body.extinguisher.technicalCondition).toBe('OBSERVADO');
  });

  it('T-EXT-12: lista con filtros y paginación del servidor', async () => {
    await createExtinguisher({ serialNumber: 'SERIE-A' });
    await createExtinguisher({ serialNumber: 'SERIE-B', brand: 'OTRA' });
    await createExtinguisher({
      serialNumber: 'SERIE-C',
      initialLocationId: catalog.areaId,
    });

    const paged = await request(server)
      .get('/api/v1/extinguishers?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const pagedBody = paged.body as {
      data: ExtinguisherBody[];
      meta: { total: number; totalPages: number; page: number };
    };
    expect(pagedBody.data).toHaveLength(2);
    expect(pagedBody.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 3,
      totalPages: 2,
    });

    const byArea = await request(server)
      .get(
        `/api/v1/extinguishers?locationId=${catalog.sedeId}&includeDescendants=true`,
      )
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((byArea.body as { meta: { total: number } }).meta.total).toBe(3);

    const byWarehouse = await request(server)
      .get(`/api/v1/extinguishers?locationId=${catalog.warehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((byWarehouse.body as { meta: { total: number } }).meta.total).toBe(
      2,
    );

    const byStatus = await request(server)
      .get('/api/v1/extinguishers?logisticsStatus=ASIGNADO')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((byStatus.body as { meta: { total: number } }).meta.total).toBe(1);

    const bySearch = await request(server)
      .get('/api/v1/extinguishers?q=SERIE-B')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((bySearch.body as { meta: { total: number } }).meta.total).toBe(1);
  });

  it('reintento idempotente devuelve el mismo recurso sin duplicar', async () => {
    const key = randomUUID();
    const first = await postAlta(adminToken, altaPayload(), key).expect(201);
    const replay = await postAlta(adminToken, altaPayload(), key).expect(200);

    expect(replay.headers['idempotent-replay']).toBe('true');
    expect((replay.body as AltaBody).id).toBe((first.body as AltaBody).id);
    expect(await prisma.extinguisher.count()).toBe(1);
    expect(await prisma.movement.count()).toBe(1);
    expect(await prisma.dueDate.count()).toBe(1);
  });

  it('misma clave con payload distinto responde IDEMPOTENCY_CONFLICT', async () => {
    const key = randomUUID();
    await postAlta(adminToken, altaPayload(), key).expect(201);
    const response = await postAlta(
      adminToken,
      altaPayload({ brand: 'Otra marca' }),
      key,
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
    expect(await prisma.extinguisher.count()).toBe(1);
  });

  it('exige Idempotency-Key y valida fechas del alta', async () => {
    const missing = await request(server)
      .post('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(altaPayload())
      .expect(422);
    expect((missing.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const future = await postAlta(
      adminToken,
      altaPayload({ manufactureDate: '2099-01-01' }),
    ).expect(422);
    expect((future.body as ErrorBody).error.code).toBe('DATE_IN_FUTURE');

    const before = await postAlta(
      adminToken,
      altaPayload({
        manufactureDate: '2020-02-01',
        acquiredAt: '2020-01-01',
      }),
    ).expect(422);
    expect((before.body as ErrorBody).error.code).toBe('DATE_BEFORE_EVENT');

    expect(await prisma.extinguisher.count()).toBe(0);
  });

  it('rechaza sede, taller, ubicación inactiva y tipo inactivo', async () => {
    const tallerId = randomUUID();
    await prisma.location.create({
      data: {
        id: tallerId,
        code: `UBI-${tallerId.slice(0, 8)}`,
        name: 'Taller',
        type: 'TALLER',
        parentId: catalog.sedeId,
        createdById: fixtures.admin.id,
      },
    });
    const inactiveId = randomUUID();
    await prisma.location.create({
      data: {
        id: inactiveId,
        code: `UBI-${inactiveId.slice(0, 8)}`,
        name: 'Almacén inactivo',
        type: 'ALMACEN',
        parentId: catalog.sedeId,
        active: false,
        createdById: fixtures.admin.id,
      },
    });

    for (const initialLocationId of [catalog.sedeId, tallerId, inactiveId]) {
      const response = await postAlta(
        adminToken,
        altaPayload({ initialLocationId }),
      ).expect(422);
      expect((response.body as ErrorBody).error.code).toBe(
        'DESTINATION_INVALID',
      );
    }

    await prisma.extinguisherType.update({
      where: { id: catalog.typeId },
      data: { active: false },
    });
    const inactiveType = await postAlta(adminToken, altaPayload()).expect(422);
    expect((inactiveType.body as ErrorBody).error.code).toBe(
      'VALIDATION_ERROR',
    );

    expect(await prisma.extinguisher.count()).toBe(0);
  });

  it('no inventa fecha EQUIPO si faltan fabricación y vencimiento', async () => {
    await prisma.extinguisherType.update({
      where: { id: catalog.typeId },
      data: { usefulLifeYears: null },
    });
    const body = await createExtinguisher({
      manufactureDate: null,
      acquiredAt: null,
      commissionedAt: null,
      manufacturerExpiryDate: null,
    });

    expect(
      await prisma.dueDate.count({
        where: { extinguisherId: body.id, eventType: 'EQUIPO' },
      }),
    ).toBe(0);
  });

  it('T-QR-01: resuelve el código autenticado', async () => {
    const created = await createExtinguisher();
    const response = await request(server)
      .get(`/api/v1/extinguishers/by-code/${created.assetCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect((response.body as ExtinguisherBody).id).toBe(created.id);
  });

  it('T-QR-02: código inexistente responde 404', async () => {
    const response = await request(server)
      .get('/api/v1/extinguishers/by-code/EXT-999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect((response.body as ErrorBody).error.code).toBe('ASSET_NOT_FOUND');
  });

  it('T-QR-03: un activo dado de baja se resuelve con su estado', async () => {
    const id = randomUUID();
    await prisma.extinguisher.create({
      data: {
        id,
        assetCode: 'EXT-999001',
        typeId: catalog.typeId,
        capacityValue: '6.00',
        capacityUnit: 'KG',
        logisticsStatus: 'DADO_DE_BAJA',
        technicalCondition: 'OPERATIVO',
        placementType: 'NONE',
        retiredAt: new Date(),
        retirementReason: 'Fin de vida útil',
        createdById: fixtures.admin.id,
      },
    });

    const response = await request(server)
      .get('/api/v1/extinguishers/by-code/EXT-999001')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect((response.body as ExtinguisherBody).logisticsStatus).toBe(
      'DADO_DE_BAJA',
    );
  });

  it('T-QR-04: resolver sin token responde 401', async () => {
    await request(server)
      .get('/api/v1/extinguishers/by-code/EXT-999999')
      .expect(401);
  });

  it('T-QR-05: supera el límite por usuario y devuelve Retry-After', async () => {
    const created = await createExtinguisher();

    await request(server)
      .get(`/api/v1/extinguishers/by-code/${created.assetCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    await request(server)
      .get(`/api/v1/extinguishers/by-code/${created.assetCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const limited = await request(server)
      .get(`/api/v1/extinguishers/by-code/${created.assetCode}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(429);

    expect((limited.body as ErrorBody).error.code).toBe('RATE_LIMITED');
    expect(limited.headers['retry-after']).toBeDefined();
  });

  it('genera QR PNG/SVG y etiqueta HTML con el código', async () => {
    const created = await createExtinguisher();

    const png = await request(server)
      .get(`/api/v1/extinguishers/${created.id}/qr?format=png&size=128`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(png.headers['content-type']).toContain('image/png');
    expect(png.body).toBeInstanceOf(Buffer);
    expect((png.body as Buffer).subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    const svg = await request(server)
      .get(`/api/v1/extinguishers/${created.id}/qr?format=svg`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(svg.headers['content-type']).toContain('image/svg+xml');
    const svgBody = Buffer.isBuffer(svg.body)
      ? svg.body.toString('utf8')
      : (svg.text ?? '');
    expect(svgBody).toContain('<svg');

    const label = await request(server)
      .get(`/api/v1/extinguishers/${created.id}/label`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(label.headers['content-type']).toContain('text/html');
    const labelBody = Buffer.isBuffer(label.body)
      ? label.body.toString('utf8')
      : (label.text ?? '');
    expect(labelBody).toContain(created.assetCode);
  });

  it('aplica permisos: consulta no da de alta y almacén no cambia condición', async () => {
    await postAlta(consultaToken, altaPayload()).expect(403);

    const created = await createExtinguisher();
    await request(server)
      .post(`/api/v1/extinguishers/${created.id}/condition`)
      .set('Authorization', `Bearer ${almacenToken}`)
      .send({ condition: 'OBSERVADO', reason: 'Sin permiso de condición' })
      .expect(403);

    await request(server)
      .get('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
  });
});
