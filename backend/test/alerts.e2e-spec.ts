import { INestApplication } from '@nestjs/common';
import { DueDateEventType } from '@prisma/client';
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

interface AlertRow {
  extinguisherId: string;
  assetCode: string;
  eventType: string;
  dueDate: string | null;
  status: string;
  daysRemaining: number | null;
  thresholdDays: number | null;
  thresholdConfigured: boolean;
}

interface AlertListBody {
  data: AlertRow[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

interface AlertSummaryBody {
  data: Array<{
    eventType: string;
    counts: Record<string, number>;
    total: number;
  }>;
  totals: Record<string, number>;
}

interface AlertSettingView {
  eventType: string;
  daysBefore: number | null;
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: { id: string; fullName: string } | null;
}

interface Catalog {
  typeId: string;
  warehouseA: string;
}

const EVENT_TYPES = [
  'EQUIPO',
  'INSPECCION',
  'MANTENIMIENTO',
  'RECARGA',
  'PRUEBA_HIDROSTATICA',
] as const;

/** Fecha calendario de hoy en `America/Lima`, sin depender de la zona del servidor. */
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

describe('Alertas y umbrales (e2e)', () => {
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

  const setDueDate = async (
    extinguisherId: string,
    eventType: DueDateEventType,
    isoDate: string,
  ): Promise<void> => {
    const dueDate = new Date(`${isoDate}T00:00:00.000Z`);
    await prisma.dueDate.upsert({
      where: {
        extinguisherId_eventType: { extinguisherId, eventType },
      },
      create: {
        id: randomUUID(),
        extinguisherId,
        eventType,
        dueDate,
        sourceType: 'EXTINGUISHER',
        sourceId: extinguisherId,
      },
      update: {
        dueDate,
        sourceType: 'EXTINGUISHER',
        sourceId: extinguisherId,
        sourceEventAt: null,
      },
    });
  };

  const listAlerts = (
    token: string,
    query: Record<string, string> = {},
  ): request.Test =>
    request(server)
      .get('/api/v1/alerts')
      .query(query)
      .set('Authorization', `Bearer ${token}`);

  const alertsOf = async (
    token: string,
    query: Record<string, string>,
  ): Promise<AlertRow[]> => {
    const response = await listAlerts(token, query).expect(200);
    return (response.body as AlertListBody).data;
  };

  const putSetting = (
    token: string,
    eventType: string,
    body: Record<string, unknown>,
  ): request.Test =>
    request(server)
      .put(`/api/v1/alert-settings/${eventType}`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

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

    catalog = { typeId, warehouseA };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-ALE-06: una categoría sin fecha documentada queda SIN_FECHA_CONFIGURADA', async () => {
    const created = await createExtinguisher();

    const rows = await alertsOf(adminToken, {
      eventType: 'RECARGA',
      assetCode: created.assetCode,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SIN_FECHA_CONFIGURADA');
    expect(rows[0].dueDate).toBeNull();
    expect(rows[0].daysRemaining).toBeNull();
  });

  it('T-ALE-07: las bajas se excluyen por defecto y se incluyen con includeRetired', async () => {
    const created = await createExtinguisher();

    const response = await request(server)
      .post(`/api/v1/extinguishers/${created.id}/retire`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        movedAt: new Date().toISOString(),
        authorizedBy: 'María López',
        reason: 'Equipo fuera de servicio definitivo',
        documentRef: 'ACTA-BAJA-2026-001',
        rowVersion: created.extinguisher.rowVersion,
      })
      .expect(201);
    expect(
      (response.body as { extinguisher: { logisticsStatus: string } })
        .extinguisher.logisticsStatus,
    ).toBe('DADO_DE_BAJA');

    expect(
      await alertsOf(adminToken, {
        eventType: 'EQUIPO',
        assetCode: created.assetCode,
      }),
    ).toHaveLength(0);

    const included = await alertsOf(adminToken, {
      eventType: 'EQUIPO',
      assetCode: created.assetCode,
      includeRetired: 'true',
    });
    expect(included).toHaveLength(1);
    expect(included[0].extinguisherId).toBe(created.id);
  });

  it('T-ALE-08: una categoría deshabilitada no aparece en alertas ni en el resumen', async () => {
    const created = await createExtinguisher();
    await setDueDate(created.id, 'MANTENIMIENTO', addDays(limaToday(), 3));

    const before = await alertsOf(adminToken, {
      eventType: 'MANTENIMIENTO',
      assetCode: created.assetCode,
    });
    expect(before).toHaveLength(1);

    await putSetting(adminToken, 'MANTENIMIENTO', { enabled: false }).expect(
      200,
    );

    const after = await alertsOf(adminToken, {
      eventType: 'MANTENIMIENTO',
      assetCode: created.assetCode,
    });
    expect(after).toHaveLength(0);

    const summary = await request(server)
      .get('/api/v1/alerts/summary')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = summary.body as AlertSummaryBody;
    expect(
      body.data.find((entry) => entry.eventType === 'MANTENIMIENTO'),
    ).toBeUndefined();
  });

  it('T-ALE-09: repetir la consulta devuelve los mismos resultados sin duplicar filas', async () => {
    const created = await createExtinguisher();
    await setDueDate(created.id, 'RECARGA', addDays(limaToday(), 10));

    const first = await alertsOf(adminToken, {
      assetCode: created.assetCode,
    });
    const second = await alertsOf(adminToken, {
      assetCode: created.assetCode,
    });

    expect(second).toEqual(first);
    expect(first).toHaveLength(EVENT_TYPES.length);
    const keys = new Set(
      first.map((row) => `${row.extinguisherId}-${row.eventType}`),
    );
    expect(keys.size).toBe(first.length);
  });

  it('T-ALE-11: cambiar el umbral reclasifica sin modificar las fechas fuente y deja auditoría', async () => {
    const created = await createExtinguisher();
    const dueDate = addDays(limaToday(), 10);
    await setDueDate(created.id, 'RECARGA', dueDate);

    const before = await alertsOf(adminToken, {
      eventType: 'RECARGA',
      assetCode: created.assetCode,
    });
    expect(before[0].status).toBe('VIGENTE');
    expect(before[0].daysRemaining).toBe(10);

    const updated = await putSetting(adminToken, 'RECARGA', {
      daysBefore: 30,
    }).expect(200);
    const setting = updated.body as AlertSettingView;
    expect(setting.daysBefore).toBe(30);
    expect(setting.enabled).toBe(true);
    expect(setting.updatedBy?.id).toBe(fixtures.admin.id);

    const after = await alertsOf(adminToken, {
      eventType: 'RECARGA',
      assetCode: created.assetCode,
    });
    expect(after[0].status).toBe('POR_VENCER');
    expect(after[0].thresholdDays).toBe(30);
    expect(after[0].thresholdConfigured).toBe(true);
    expect(after[0].dueDate).toBe(dueDate);

    const stored = await prisma.dueDate.findUniqueOrThrow({
      where: {
        extinguisherId_eventType: {
          extinguisherId: created.id,
          eventType: 'RECARGA',
        },
      },
    });
    expect(stored.dueDate.toISOString().slice(0, 10)).toBe(dueDate);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'ALERT_SETTING_UPDATED',
        entityType: 'ALERT_SETTING',
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorUserId).toBe(fixtures.admin.id);
  });

  it('T-ALE-12: un umbral negativo o no entero responde 422 y un permiso sin alerts.settings responde 403', async () => {
    const negative = await putSetting(adminToken, 'INSPECCION', {
      daysBefore: -1,
    }).expect(422);
    expect((negative.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const decimal = await putSetting(adminToken, 'INSPECCION', {
      daysBefore: 1.5,
    }).expect(422);
    expect((decimal.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    await putSetting(consultaToken, 'INSPECCION', {
      daysBefore: 30,
    }).expect(403);
    await putSetting(almacenToken, 'INSPECCION', {
      daysBefore: 30,
    }).expect(403);
    await putSetting(seguridadToken, 'INSPECCION', {
      daysBefore: 30,
    }).expect(403);
  });

  it('T-ALE-14: EQUIPO calcula la fecha desde manufactureDate + usefulLifeYears', async () => {
    const created = await createExtinguisher({
      manufactureDate: '2010-01-01',
      acquiredAt: '2010-02-01',
      commissionedAt: '2010-02-10',
      manufacturerExpiryDate: null,
    });

    const rows = await alertsOf(adminToken, {
      eventType: 'EQUIPO',
      assetCode: created.assetCode,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].dueDate).toBe('2020-01-01');
    expect(rows[0].status).toBe('VENCIDO');
    expect(rows[0].daysRemaining).toBeLessThan(0);
  });

  it('T-ALE-15: EQUIPO sin fecha documentada ni calculable queda SIN_FECHA_CONFIGURADA', async () => {
    const created = await createExtinguisher({
      manufactureDate: null,
      manufacturerExpiryDate: null,
      acquiredAt: null,
      commissionedAt: null,
    });

    const rows = await alertsOf(adminToken, {
      eventType: 'EQUIPO',
      assetCode: created.assetCode,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SIN_FECHA_CONFIGURADA');
    expect(rows[0].dueDate).toBeNull();
    expect(
      await prisma.dueDate.count({ where: { extinguisherId: created.id } }),
    ).toBe(0);
  });

  it('T-ALE-16: una inspección sin próxima fecha deja la categoría SIN_FECHA_CONFIGURADA', async () => {
    const created = await createExtinguisher();
    await setDueDate(created.id, 'INSPECCION', addDays(limaToday(), 40));

    const inspectedAt = new Date(
      Math.max(
        new Date(created.movement.movedAt).getTime(),
        new Date(created.extinguisher.createdAt).getTime(),
      ) + 1000,
    ).toISOString();

    await request(server)
      .post(`/api/v1/extinguishers/${created.id}/inspections`)
      .set('Authorization', `Bearer ${seguridadToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        inspectedAt,
        inspectorName: 'Ana Torres',
        result: 'APROBADO',
        notes: 'Inspección sin programar la próxima fecha.',
      })
      .expect(201);

    const rows = await alertsOf(adminToken, {
      eventType: 'INSPECCION',
      assetCode: created.assetCode,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('SIN_FECHA_CONFIGURADA');
    expect(rows[0].dueDate).toBeNull();
  });

  it('T-ALE-17: sin umbrales configurados no se generan POR_VENCER', async () => {
    const created = await createExtinguisher();
    await setDueDate(created.id, 'RECARGA', addDays(limaToday(), 3));

    const settingsResponse = await request(server)
      .get('/api/v1/alert-settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const settings = (settingsResponse.body as { data: AlertSettingView[] })
      .data;
    expect(settings).toHaveLength(EVENT_TYPES.length);
    for (const setting of settings) {
      expect(setting.daysBefore).toBeNull();
      expect(setting.enabled).toBe(true);
      expect(setting.updatedAt).toBeNull();
      expect(setting.updatedBy).toBeNull();
    }

    const rows = await alertsOf(adminToken, { assetCode: created.assetCode });
    expect(rows.every((row) => row.status !== 'POR_VENCER')).toBe(true);
    const recharge = rows.find((row) => row.eventType === 'RECARGA');
    expect(recharge?.status).toBe('VIGENTE');
  });

  it('T-ALE-18: cualquier rol con alerts.read puede consultar las alertas', async () => {
    await createExtinguisher();

    for (const token of [
      adminToken,
      consultaToken,
      almacenToken,
      seguridadToken,
    ]) {
      const response = await listAlerts(token).expect(200);
      expect((response.body as AlertListBody).meta.total).toBeGreaterThan(0);
    }
  });

  it('T-ALE-19: no existe endpoint externo de suscripción o envío de alertas', async () => {
    await request(server)
      .get('/api/v1/alerts/subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(server)
      .post('/api/v1/alerts/notify')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(404);
  });

  it('T-ALE-20: pagina y ordena las alertas en el servidor', async () => {
    const first = await createExtinguisher();
    const second = await createExtinguisher();
    await setDueDate(first.id, 'RECARGA', addDays(limaToday(), 5));
    await setDueDate(second.id, 'RECARGA', addDays(limaToday(), 1));

    const response = await listAlerts(adminToken, {
      eventType: 'RECARGA',
      sort: 'dueDate',
      page: '1',
      pageSize: '1',
    }).expect(200);
    const body = response.body as AlertListBody;

    expect(body.meta).toEqual({
      page: 1,
      pageSize: 1,
      total: 2,
      totalPages: 2,
    });
    expect(body.data[0].extinguisherId).toBe(second.id);

    await listAlerts(adminToken, { status: 'INVALIDO' }).expect(422);
    await listAlerts(adminToken, { pageSize: '500' }).expect(422);
  });
});
