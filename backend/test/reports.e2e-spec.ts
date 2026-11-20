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

interface AltaBody {
  id: string;
  assetCode: string;
  extinguisher: {
    id: string;
    assetCode: string;
    logisticsStatus: string;
    rowVersion: number;
    createdAt: string;
  };
  movement: { id: string; movedAt: string };
}

interface ReportListBody<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface Catalog {
  typeId: string;
  warehouseA: string;
  areaA: string;
  providerId: string;
}

describe('Reportes y exportación CSV (e2e)', () => {
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

  const at = (created: AltaBody, seconds: number): string => {
    const base = Math.max(
      new Date(created.movement.movedAt).getTime(),
      new Date(created.extinguisher.createdAt).getTime(),
    );
    return new Date(base + seconds * 1000).toISOString();
  };

  const postMovement = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/movements`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send(payload);

  const postRetire = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/retire`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send(payload);

  const postAdjust = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/adjustments`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send(payload);

  const getReport = (
    token: string,
    path: string,
    query: Record<string, string> = {},
  ): request.Test =>
    request(server)
      .get(`/api/v1/reports/${path}`)
      .query(query)
      .set('Authorization', `Bearer ${token}`);

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

    const areaA = randomUUID();
    await prisma.location.create({
      data: {
        id: areaA,
        code: 'UBI-000201',
        name: 'Área de producción',
        type: 'AREA',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });

    const providerId = randomUUID();
    await prisma.externalParty.create({
      data: {
        id: providerId,
        code: 'PRV-0001',
        name: 'Proveedor de mantenimiento',
        partyType: 'PROVEEDOR_MANTENIMIENTO',
      },
    });

    catalog = { typeId, warehouseA, areaA, providerId };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-REP-01: el inventario filtra por estado y excluye bajas por defecto', async () => {
    const warehouseAsset = await createExtinguisher({
      serialNumber: '=SUM(1,2)',
    });
    const second = await createExtinguisher();
    const retired = await createExtinguisher();

    await postMovement(almacenToken, second.id, {
      type: 'SALIDA',
      originLocationId: catalog.warehouseA,
      destinationLocationId: catalog.areaA,
      movedAt: at(second, 1),
      requestedBy: 'Juan Pérez',
      deliveredBy: 'Juan Pérez',
      receivedBy: 'Carlos Ruiz',
      reason: 'Instalación en el área de producción',
      documentRef: 'ACTA-2026-001',
      rowVersion: second.extinguisher.rowVersion,
    }).expect(201);

    await postRetire(seguridadToken, retired.id, {
      movedAt: at(retired, 1),
      authorizedBy: 'María López',
      reason: 'Equipo fuera de servicio definitivo',
      documentRef: 'ACTA-BAJA-2026-001',
      rowVersion: retired.extinguisher.rowVersion,
    }).expect(201);

    const byStatus = await getReport(consultaToken, 'inventory', {
      logisticsStatus: 'ASIGNADO',
      page: '1',
      pageSize: '10',
    }).expect(200);
    const byStatusBody = byStatus.body as ReportListBody<{
      assetCode: string;
      logisticsStatus: string;
    }>;
    expect(byStatusBody.meta).toEqual({
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    });
    expect(byStatusBody.data[0].assetCode).toBe(second.assetCode);

    const byLocation = await getReport(consultaToken, 'inventory', {
      locationId: catalog.warehouseA,
    }).expect(200);
    expect(
      (byLocation.body as ReportListBody<{ assetCode: string }>).data.map(
        (row) => row.assetCode,
      ),
    ).toEqual([warehouseAsset.assetCode]);

    const defaultList = await getReport(consultaToken, 'inventory', {
      pageSize: '100',
    }).expect(200);
    expect((defaultList.body as ReportListBody<unknown>).meta.total).toBe(2);

    const withRetired = await getReport(consultaToken, 'inventory', {
      includeRetired: 'true',
      pageSize: '100',
    }).expect(200);
    expect((withRetired.body as ReportListBody<unknown>).meta.total).toBe(3);
  });

  it('T-REP-02: los movimientos se filtran por periodo y tipo', async () => {
    const created = await createExtinguisher();
    const movedAt = at(created, 2);
    await postMovement(almacenToken, created.id, {
      type: 'SALIDA',
      originLocationId: catalog.warehouseA,
      destinationLocationId: catalog.areaA,
      movedAt,
      requestedBy: 'Juan Pérez',
      deliveredBy: 'Juan Pérez',
      receivedBy: 'Carlos Ruiz',
      reason: 'Instalación en el área de producción',
      documentRef: 'ACTA-2026-001',
      rowVersion: created.extinguisher.rowVersion,
    }).expect(201);

    const today = movedAt.slice(0, 10);
    const response = await getReport(consultaToken, 'movements', {
      type: 'SALIDA',
      from: today,
      to: today,
      assetCode: created.assetCode,
    }).expect(200);
    const body = response.body as ReportListBody<{
      type: string;
      extinguisher: { assetCode: string };
      origin: { label: string };
      destination: { label: string };
    }>;

    expect(body.meta.total).toBe(1);
    expect(body.data[0].type).toBe('SALIDA');
    expect(body.data[0].extinguisher.assetCode).toBe(created.assetCode);
    expect(body.data[0].destination.label).toContain('producción');

    const withoutType = await getReport(consultaToken, 'movements', {
      assetCode: created.assetCode,
    }).expect(200);
    expect((withoutType.body as ReportListBody<unknown>).meta.total).toBe(2);
  });

  it('T-REP-03: exporta CSV con los mismos filtros y protección de fórmulas', async () => {
    await createExtinguisher({ serialNumber: '=SUM(1,2)' });
    const assigned = await createExtinguisher();
    await postMovement(almacenToken, assigned.id, {
      type: 'SALIDA',
      originLocationId: catalog.warehouseA,
      destinationLocationId: catalog.areaA,
      movedAt: at(assigned, 1),
      requestedBy: 'Juan Pérez',
      deliveredBy: 'Juan Pérez',
      receivedBy: 'Carlos Ruiz',
      reason: 'Instalación en el área de producción',
      documentRef: 'ACTA-2026-001',
      rowVersion: assigned.extinguisher.rowVersion,
    }).expect(201);

    const response = await getReport(seguridadToken, 'inventory/export').expect(
      200,
    );
    const body = response.text;

    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('.csv');
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain('Código de activo');
    expect(body).toContain(assigned.assetCode);
    expect(body).toContain("'=SUM(1,2)");

    const filtered = await getReport(seguridadToken, 'inventory/export', {
      logisticsStatus: 'ASIGNADO',
    }).expect(200);
    const filteredLines = filtered.text.trimEnd().split('\r\n');
    expect(filteredLines).toHaveLength(2);
    expect(filteredLines[1]).toContain(assigned.assetCode);

    const movementsCsv = await getReport(seguridadToken, 'movements/export', {
      type: 'SALIDA',
    }).expect(200);
    expect(movementsCsv.text).toContain('Tipo de movimiento');
    expect(movementsCsv.text).toContain('SALIDA');
  });

  it('T-REP-04: la exportación exige reports.export y reports.read', async () => {
    await getReport(consultaToken, 'inventory/export').expect(403);
    await getReport(almacenToken, 'inventory/export').expect(403);

    await request(server).get('/api/v1/reports/inventory/export').expect(401);
    await request(server)
      .get('/api/v1/reports/inventory')
      .set('Authorization', `Bearer ${seguridadToken}`)
      .expect(200);
  });

  it('T-REP-05: PDF/Excel y reportes inexistentes responden 404', async () => {
    const pdf = await getReport(seguridadToken, 'inventory/export', {
      format: 'pdf',
    }).expect(404);
    expect((pdf.body as ErrorBody).error.code).toBe('NOT_FOUND');

    await getReport(seguridadToken, 'inventory/export', {
      format: 'xlsx',
    }).expect(404);

    await getReport(seguridadToken, 'pdf/export').expect(404);
    await getReport(seguridadToken, 'excel/export').expect(404);

    await getReport(seguridadToken, 'inventory/export', {
      format: 'csv',
    }).expect(200);
  });

  it('T-REP-06: mantenimiento incluye servicios y costos sin totales financieros', async () => {
    const created = await createExtinguisher();
    const orderId = randomUUID();
    const openedAt = new Date(at(created, 3));
    await prisma.maintenanceOrder.create({
      data: {
        id: orderId,
        extinguisherId: created.id,
        providerId: catalog.providerId,
        status: 'CERRADA',
        sentMovementId: created.movement.id,
        openedAt,
        closedAt: openedAt,
        reason: 'Mantenimiento anual',
        createdById: fixtures.admin.id,
      },
    });
    await prisma.maintenanceService.create({
      data: {
        id: randomUUID(),
        extinguisherId: created.id,
        maintenanceOrderId: orderId,
        serviceType: 'RECARGA',
        performedAt: openedAt,
        performedOn: new Date('2026-05-10T00:00:00.000Z'),
        performedByUserId: fixtures.admin.id,
        providerId: catalog.providerId,
        result: 'APROBADO',
        certificateNo: 'CERT-2026-001',
        certificateDate: new Date('2026-05-10T00:00:00.000Z'),
        nextDueDate: new Date('2027-05-10T00:00:00.000Z'),
        cost: '150.00',
        currency: 'PEN',
        documentRef: 'DOC-2026-001',
        createdById: fixtures.admin.id,
      },
    });

    const response = await getReport(consultaToken, 'maintenance', {
      status: 'CERRADA',
      assetCode: created.assetCode,
    }).expect(200);
    const body = response.body as ReportListBody<{
      id: string;
      services: Array<{
        serviceType: string;
        cost: string | null;
        currency: string | null;
      }>;
    }>;

    expect(body.meta.total).toBe(1);
    expect(body.data[0].id).toBe(orderId);
    expect(body.data[0].services).toHaveLength(1);
    expect(body.data[0].services[0]).toMatchObject({
      serviceType: 'RECARGA',
      cost: '150.00',
      currency: 'PEN',
    });
    expect(body).not.toHaveProperty('totals');
    expect(body).not.toHaveProperty('costTotal');

    const csv = await getReport(seguridadToken, 'maintenance/export', {
      status: 'CERRADA',
    }).expect(200);
    expect(csv.text).toContain('Tipo de servicio');
    expect(csv.text).toContain('RECARGA');
    expect(csv.text).toContain('150.00');
  });

  it('T-REP-07: inspecciones se filtran por resultado', async () => {
    const created = await createExtinguisher();
    await request(server)
      .post(`/api/v1/extinguishers/${created.id}/inspections`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        inspectedAt: at(created, 4),
        inspectorName: 'Ana Torres',
        result: 'APROBADO_CON_OBSERVACIONES',
        nextDueDate: '2027-05-10',
      })
      .expect(201);

    const response = await getReport(consultaToken, 'inspections', {
      result: 'APROBADO_CON_OBSERVACIONES',
    }).expect(200);
    const body = response.body as ReportListBody<{
      extinguisher: { assetCode: string };
      result: string;
    }>;

    expect(body.meta.total).toBe(1);
    expect(body.data[0].extinguisher.assetCode).toBe(created.assetCode);
    expect(body.data[0].result).toBe('APROBADO_CON_OBSERVACIONES');

    const csv = await getReport(seguridadToken, 'inspections/export', {
      result: 'APROBADO_CON_OBSERVACIONES',
    }).expect(200);
    expect(csv.text).toContain('Inspector');
    expect(csv.text).toContain('Ana Torres');
  });

  it('T-REP-08: bajas y ajustes se reportan y exportan con su motivo', async () => {
    const retired = await createExtinguisher();
    const adjusted = await createExtinguisher();

    await postRetire(seguridadToken, retired.id, {
      movedAt: at(retired, 1),
      authorizedBy: 'María López',
      reason: 'Equipo fuera de servicio definitivo',
      documentRef: 'ACTA-BAJA-2026-001',
      rowVersion: retired.extinguisher.rowVersion,
    }).expect(201);

    await postAdjust(adminToken, adjusted.id, {
      placementType: 'INTERNAL',
      locationId: catalog.areaA,
      movedAt: at(adjusted, 2),
      authorizedBy: 'María López',
      reason: 'Corrección de ubicación registrada por error',
      documentRef: 'ACTA-AJUSTE-2026-001',
      rowVersion: adjusted.extinguisher.rowVersion,
    }).expect(201);

    const all = await getReport(consultaToken, 'retired').expect(200);
    const allBody = all.body as ReportListBody<{
      type: string;
      correctsMovementId: string | null;
      authorizedBy: string | null;
    }>;
    expect(allBody.meta.total).toBe(2);
    expect(allBody.data.map((row) => row.type).sort()).toEqual([
      'AJUSTE',
      'BAJA',
    ]);

    const onlyBaja = await getReport(consultaToken, 'retired', {
      type: 'BAJA',
    }).expect(200);
    expect(
      (onlyBaja.body as ReportListBody<{ type: string }>).data,
    ).toHaveLength(1);
    expect(
      (onlyBaja.body as ReportListBody<{ type: string }>).data[0].type,
    ).toBe('BAJA');

    const csv = await getReport(seguridadToken, 'retired/export').expect(200);
    expect(csv.text).toContain('Movimiento corregido');
    expect(csv.text).toContain('ACTA-BAJA-2026-001');
  });
});
