import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { createTestApp } from './e2e-app';
import { AuthFixtures, TEST_PASSWORD, seedAuthFixtures } from './e2e-fixtures';
import { prisma, resetDatabase } from './integration/test-db';

interface ErrorBody {
  error: { code: string; message: string };
}

interface ExtinguisherBody {
  id: string;
  assetCode: string;
  logisticsStatus: string;
  technicalCondition: string;
  placementType: string;
  currentLocation: { id: string } | null;
  rowVersion: number;
  createdAt: string;
  dueDates?: Array<{ eventType: string; dueDate: string | null }>;
  lastInspection?: {
    id: string;
    result: string;
    inspectedOn: string;
  } | null;
}

interface AltaBody {
  id: string;
  assetCode: string;
  extinguisher: ExtinguisherBody;
  movement: { id: string; movedAt: string };
}

interface InspectionView {
  id: string;
  extinguisher: { id: string; assetCode: string };
  inspectedAt: string;
  inspectedOn: string;
  inspectorName: string;
  result: string;
  checklist: unknown;
  nextDueDate: string | null;
}

interface OperationBody {
  inspection: InspectionView;
  extinguisher: ExtinguisherBody;
}

interface Catalog {
  typeId: string;
  warehouseA: string;
}

describe('Inspecciones (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let adminToken: string;
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

  const at = (created: AltaBody, seconds: number): string => {
    const base = Math.max(
      new Date(created.movement.movedAt).getTime(),
      new Date(created.extinguisher.createdAt).getTime(),
    );
    return new Date(base + seconds * 1000).toISOString();
  };

  const inspectionPayload = (
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    inspectedAt: at(created, 30),
    inspectorName: 'Ana Torres',
    result: 'APROBADO',
    checklist: {
      presion: 'OK',
      precinto: 'OK',
      senalizacion: 'OK',
      acceso: 'OK',
    },
    nextDueDate: '2027-05-10',
    notes: 'Inspección visual conforme.',
    documentRef: 'INS-2026-0456',
    ...overrides,
  });

  const postInspection = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/inspections`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const dueDatesOf = (id: string) =>
    prisma.dueDate.findMany({
      where: { extinguisherId: id },
      orderBy: { eventType: 'asc' },
    });

  const inspectionDueDate = async (id: string): Promise<string | null> => {
    const due = (await dueDatesOf(id)).find(
      (row) => row.eventType === 'INSPECCION',
    );
    return due === undefined ? null : due.dueDate.toISOString().slice(0, 10);
  };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    adminToken = await authenticate(fixtures.admin.email);
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

    const warehouseA = randomUUID();
    await prisma.location.create({
      data: {
        id: warehouseA,
        code: 'UBI-000101',
        name: 'Almacén Central',
        type: 'ALMACEN',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });

    catalog = { typeId, warehouseA };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-INS-01: registra la inspección y actualiza la fecha objetivo INSPECCION', async () => {
    const created = await createExtinguisher();

    const response = await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.inspection.result).toBe('APROBADO');
    expect(body.inspection.checklist).toEqual(
      inspectionPayload(created).checklist,
    );
    expect(body.inspection.nextDueDate).toBe('2027-05-10');
    expect(await inspectionDueDate(created.id)).toBe('2027-05-10');

    const due = (await dueDatesOf(created.id)).find(
      (row) => row.eventType === 'INSPECCION',
    );
    expect(due?.sourceType).toBe('INSPECTION');
    expect(due?.sourceId).toBe(body.inspection.id);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'INSPECTION_CREATED', entityId: body.inspection.id },
    });
    expect(audit).not.toBeNull();
  });

  it('T-INS-01b: un reintento idéntico devuelve la misma inspección sin duplicar', async () => {
    const created = await createExtinguisher();
    const key = randomUUID();
    const payload = inspectionPayload(created);

    const first = await postInspection(
      seguridadToken,
      created.id,
      payload,
      key,
    ).expect(201);
    const second = await postInspection(
      seguridadToken,
      created.id,
      payload,
      key,
    ).expect(200);

    expect(second.headers['idempotent-replay']).toBe('true');
    expect((second.body as OperationBody).inspection.id).toBe(
      (first.body as OperationBody).inspection.id,
    );
    expect(
      await prisma.inspection.count({ where: { extinguisherId: created.id } }),
    ).toBe(1);
  });

  it('T-INS-02: una inspección sin próxima fecha elimina la categoría', async () => {
    const created = await createExtinguisher();
    await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, { nextDueDate: '2027-05-10' }),
    ).expect(201);
    expect(await inspectionDueDate(created.id)).toBe('2027-05-10');

    await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, {
        inspectedAt: at(created, 60),
        nextDueDate: undefined,
      }),
    ).expect(201);

    expect(await inspectionDueDate(created.id)).toBeNull();
  });

  it('T-INS-03: rechaza una próxima fecha anterior o igual a la inspección', async () => {
    const created = await createExtinguisher();

    const response = await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, { nextDueDate: '2020-02-10' }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe(
      'PRESCRIPTION_INVALID',
    );
    expect(await inspectionDueDate(created.id)).toBeNull();
  });

  it('T-INS-04: la inspección no cambia la condición técnica', async () => {
    const created = await createExtinguisher({
      technicalCondition: 'OBSERVADO',
    });

    const response = await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, { result: 'APROBADO' }),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.extinguisher.technicalCondition).toBe('OBSERVADO');
    const stored = await prisma.extinguisher.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.technicalCondition).toBe('OBSERVADO');
  });

  it('T-INS-05: ALMACEN no puede registrar inspecciones', async () => {
    const created = await createExtinguisher();

    const response = await postInspection(
      almacenToken,
      created.id,
      inspectionPayload(created),
    ).expect(403);

    expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
    expect(
      await prisma.inspection.count({ where: { extinguisherId: created.id } }),
    ).toBe(0);
  });

  it('T-INS-06: una inspección retroactiva no reemplaza la fecha vigente', async () => {
    const created = await createExtinguisher();

    await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, {
        inspectedAt: at(created, 120),
        nextDueDate: '2028-01-15',
      }),
    ).expect(201);

    await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, {
        inspectedAt: at(created, 30),
        nextDueDate: '2026-12-01',
      }),
    ).expect(201);

    expect(await inspectionDueDate(created.id)).toBe('2028-01-15');
  });

  it('T-INS-09: un resultado RECHAZADO no cambia la condición y queda como último resultado', async () => {
    const created = await createExtinguisher();

    await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created, { result: 'RECHAZADO' }),
    ).expect(201);

    const stored = await prisma.extinguisher.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.technicalCondition).toBe('OPERATIVO');

    const detail = await request(server)
      .get(`/api/v1/extinguishers/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = detail.body as ExtinguisherBody;
    expect(body.lastInspection?.result).toBe('RECHAZADO');
  });

  it('T-CON-04: dos inspecciones simultáneas se registran y la proyección usa la posterior', async () => {
    const created = await createExtinguisher();

    const [first, second] = await Promise.all([
      postInspection(
        seguridadToken,
        created.id,
        inspectionPayload(created, {
          inspectedAt: at(created, 30),
          nextDueDate: '2027-01-10',
        }),
      ),
      postInspection(
        seguridadToken,
        created.id,
        inspectionPayload(created, {
          inspectedAt: at(created, 60),
          nextDueDate: '2027-02-10',
        }),
      ),
    ]);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(
      await prisma.inspection.count({ where: { extinguisherId: created.id } }),
    ).toBe(2);
    expect(await inspectionDueDate(created.id)).toBe('2027-02-10');
  });

  it('lista y detalle: filtra por activo y devuelve 404 si no existe', async () => {
    const created = await createExtinguisher();
    const response = await postInspection(
      seguridadToken,
      created.id,
      inspectionPayload(created),
    ).expect(201);
    const inspectionId = (response.body as OperationBody).inspection.id;

    const list = await request(server)
      .get('/api/v1/inspections')
      .query({ extinguisherId: created.id, result: 'APROBADO' })
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = list.body as {
      data: InspectionView[];
      meta: { total: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe(inspectionId);

    await request(server)
      .get(`/api/v1/inspections/${inspectionId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const missing = await request(server)
      .get(`/api/v1/inspections/${randomUUID()}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    expect((missing.body as ErrorBody).error.code).toBe('INSPECTION_NOT_FOUND');
  });
});
