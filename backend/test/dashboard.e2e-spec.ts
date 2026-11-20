import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { createTestApp } from './e2e-app';
import { AuthFixtures, TEST_PASSWORD, seedAuthFixtures } from './e2e-fixtures';
import { prisma, resetDatabase } from './integration/test-db';

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

interface DashboardBody {
  generatedAt: string;
  assets: {
    operationalTotal: number;
    retiredTotal: number;
    byLogisticsStatus: Record<string, number>;
    byTechnicalCondition: Record<string, number>;
    byPlacement: Record<string, number>;
    byLocation: Array<{
      id: string;
      code: string;
      name: string;
      type: string;
      count: number;
    }>;
    withoutLocation: number;
  };
  maintenance: {
    openOrders: number;
    byStatus: Record<string, number>;
    overdueReturns: number;
  };
  alerts: {
    totals: Record<string, number>;
    byEventType: Array<{
      eventType: string;
      counts: Record<string, number>;
      total: number;
    }>;
  };
}

function limaToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let adminToken: string;
  let consultaToken: string;
  let warehouseA: string;
  let areaA: string;
  let providerId: string;

  const authenticate = async (email: string): Promise<string> => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  };

  const createExtinguisher = async (): Promise<AltaBody> => {
    const response = await request(server)
      .post('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        serialNumber: `SN-${randomUUID().slice(0, 8)}`,
        typeId: (await prisma.extinguisherType.findFirstOrThrow()).id,
        brand: 'ACME',
        model: 'PQS-6',
        capacityValue: 6,
        capacityUnit: 'KG',
        manufactureDate: '2020-01-01',
        acquiredAt: '2020-02-01',
        commissionedAt: '2020-02-10',
        manufacturerExpiryDate: '2035-01-01',
        initialLocationId: warehouseA,
        entrySource: 'COMPRA_CENTRAL',
        initialReason: 'Compra central para el almacén',
        receivedBy: 'Carlos Ruiz',
        documentRef: 'FACTURA-2020-001',
        technicalCondition: 'OPERATIVO',
      })
      .expect(201);
    return response.body as AltaBody;
  };

  const getSummary = (token: string): request.Test =>
    request(server)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    adminToken = await authenticate(fixtures.admin.email);

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

    warehouseA = randomUUID();
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

    areaA = randomUUID();
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

    providerId = randomUUID();
    await prisma.externalParty.create({
      data: {
        id: providerId,
        code: 'PRV-0001',
        name: 'Proveedor de mantenimiento',
        partyType: 'PROVEEDOR_MANTENIMIENTO',
      },
    });

    consultaToken = await authenticate(fixtures.consulta.email);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-DASH-01: el resumen coincide con los datos y excluye bajas de los conteos operativos', async () => {
    const stored = await createExtinguisher();
    const assigned = await createExtinguisher();
    const external = await createExtinguisher();
    const retired = await createExtinguisher();

    await prisma.extinguisher.update({
      where: { id: assigned.id },
      data: {
        logisticsStatus: 'ASIGNADO',
        technicalCondition: 'OBSERVADO',
        currentLocationId: areaA,
      },
    });

    await prisma.extinguisher.update({
      where: { id: external.id },
      data: {
        logisticsStatus: 'EN_MANTENIMIENTO',
        technicalCondition: 'NO_OPERATIVO',
        placementType: 'EXTERNAL',
        currentLocationId: null,
        currentExternalPartyId: providerId,
      },
    });

    await prisma.extinguisher.update({
      where: { id: retired.id },
      data: {
        logisticsStatus: 'DADO_DE_BAJA',
        placementType: 'NONE',
        currentLocationId: null,
        currentExternalPartyId: null,
        retiredAt: new Date(),
        retirementReason: 'Baja registrada para la prueba',
      },
    });

    await prisma.dueDate.upsert({
      where: {
        extinguisherId_eventType: {
          extinguisherId: stored.id,
          eventType: 'RECARGA',
        },
      },
      create: {
        id: randomUUID(),
        extinguisherId: stored.id,
        eventType: 'RECARGA',
        dueDate: new Date(`${addDays(limaToday(), -2)}T00:00:00.000Z`),
        sourceType: 'EXTINGUISHER',
        sourceId: stored.id,
      },
      update: {
        dueDate: new Date(`${addDays(limaToday(), -2)}T00:00:00.000Z`),
      },
    });

    await prisma.maintenanceOrder.create({
      data: {
        id: randomUUID(),
        extinguisherId: external.id,
        providerId,
        status: 'EN_PROVEEDOR',
        sentMovementId: external.movement.id,
        openedAt: new Date(external.movement.movedAt),
        expectedReturnDate: new Date(
          `${addDays(limaToday(), -1)}T00:00:00.000Z`,
        ),
        reason: 'Mantenimiento con retorno previsto vencido',
        createdById: fixtures.admin.id,
      },
    });

    const response = await getSummary(consultaToken).expect(200);
    const body = response.body as DashboardBody;

    expect(Date.parse(body.generatedAt)).not.toBeNaN();
    expect(body.assets.operationalTotal).toBe(3);
    expect(body.assets.retiredTotal).toBe(1);
    expect(body.assets.byLogisticsStatus).toEqual({
      EN_ALMACEN: 1,
      ASIGNADO: 1,
      EN_MANTENIMIENTO: 1,
      DADO_DE_BAJA: 1,
    });
    expect(body.assets.byTechnicalCondition).toEqual({
      OPERATIVO: 1,
      OBSERVADO: 1,
      NO_OPERATIVO: 1,
      PENDIENTE_INSPECCION: 0,
    });
    expect(body.assets.byPlacement).toEqual({
      INTERNAL: 2,
      EXTERNAL: 1,
      NONE: 0,
    });
    expect(body.assets.withoutLocation).toBe(1);
    expect(body.assets.byLocation).toHaveLength(2);
    expect(body.assets.byLocation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: warehouseA,
          name: 'Almacén Central',
          type: 'ALMACEN',
          count: 1,
        }),
        expect.objectContaining({
          id: areaA,
          name: 'Área de producción',
          type: 'AREA',
          count: 1,
        }),
      ]),
    );

    expect(body.maintenance.openOrders).toBe(1);
    expect(body.maintenance.byStatus.EN_PROVEEDOR).toBe(1);
    expect(body.maintenance.overdueReturns).toBe(1);

    const alertsResponse = await request(server)
      .get('/api/v1/alerts/summary')
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    const alertsBody = alertsResponse.body as {
      totals: Record<string, number>;
      data: Array<{ eventType: string; total: number }>;
    };
    expect(body.alerts.totals).toEqual(alertsBody.totals);
    expect(body.alerts.byEventType).toHaveLength(5);
    const totalAlerts = Object.values(body.alerts.totals).reduce(
      (sum, value) => sum + value,
      0,
    );
    expect(totalAlerts).toBe(15);
    expect(body.alerts.totals.VENCIDO).toBe(1);
    expect(body.alerts.totals.VIGENTE).toBe(3);
  });

  it('T-DASH-02: exige autenticación y el permiso dashboard.read', async () => {
    await request(server).get('/api/v1/dashboard/summary').expect(401);

    await prisma.rolePermission.deleteMany({
      where: {
        role: { code: 'CONSULTA' },
        permission: { code: 'dashboard.read' },
      },
    });
    const tokenWithoutPermission = await authenticate(fixtures.consulta.email);

    await getSummary(tokenWithoutPermission).expect(403);
    await getSummary(adminToken).expect(200);
  });
});
