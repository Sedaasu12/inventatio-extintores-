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
  currentExternalParty: { id: string } | null;
  rowVersion: number;
  createdAt: string;
}

interface AltaBody {
  id: string;
  assetCode: string;
  extinguisher: ExtinguisherBody;
  movement: { id: string; movedAt: string };
}

interface OrderView {
  id: string;
  status: string;
  openedAt: string;
  closedAt: string | null;
  sentMovementId: string;
  returnMovementId: string | null;
  provider: { id: string } | null;
  workshopLocation: { id: string } | null;
}

interface MovementView {
  id: string;
  type: string;
  assetSequence: number;
  movedAt: string;
  origin: { kind: string; label: string };
  destination: { kind: string; locationId: string | null };
}

interface OperationBody {
  maintenanceOrder: OrderView;
  movement: MovementView;
  extinguisher: ExtinguisherBody;
}

interface ServiceView {
  id: string;
  maintenanceOrderId: string | null;
  serviceType: string;
  performedAt: string;
  performedOn: string;
  result: string;
  nextDueDate: string | null;
  cost: string | null;
  currency: string | null;
  provider: { id: string } | null;
  performedByUser: { id: string } | null;
}

interface Catalog {
  typeId: string;
  warehouseA: string;
  areaA: string;
  workshopId: string;
  providerId: string;
  otherProviderId: string;
  inactiveProviderId: string;
}

describe('Mantenimiento (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let adminToken: string;
  let almacenToken: string;
  let seguridadToken: string;
  let consultaToken: string;
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
    // `createdAt` lo asigna la base al insertar y puede quedar por delante del
    // `movedAt` del alta, capturado al inicio de la petición. Partimos del
    // mayor de ambos para que los hechos posteriores nunca queden antes del alta.
    const base = Math.max(
      new Date(created.movement.movedAt).getTime(),
      new Date(created.extinguisher.createdAt).getTime(),
    );
    return new Date(base + seconds * 1000).toISOString();
  };

  const sendPayload = (
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    providerId: catalog.providerId,
    expectedReturnDate: '2027-06-30',
    movedAt: at(created, 1),
    authorizedBy: 'María López',
    deliveredBy: 'Juan Pérez',
    reason: 'Mantenimiento anual y recarga',
    documentRef: 'GUIA-2026-0042',
    notes: 'Se entrega en taller.',
    rowVersion: created.extinguisher.rowVersion,
    ...overrides,
  });

  const servicePayload = (
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    serviceType: 'MANTENIMIENTO',
    performedAt: at(created, 60),
    providerId: catalog.providerId,
    result: 'APROBADO',
    certificateNo: 'CERT-2026-778',
    certificateDate: '2026-11-19',
    nextDueDate: '2027-11-19',
    notes: 'Servicio conforme.',
    documentRef: 'CERT-2026-778',
    ...overrides,
  });

  const returnPayload = (
    created: AltaBody,
    rowVersion: number,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> => ({
    destinationLocationId: catalog.warehouseA,
    movedAt: at(created, 120),
    deliveredBy: 'Proveedor de mantenimiento',
    receivedBy: 'Juan Pérez',
    authorizedBy: 'María López',
    reason: 'Retorno de mantenimiento',
    documentRef: 'ACTA-RET-2026-011',
    notes: 'Equipo recibido conforme.',
    rowVersion,
    ...overrides,
  });

  const postSend = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/maintenance/send`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const postOrderService = (
    token: string,
    orderId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/maintenance-orders/${orderId}/services`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const postStandaloneService = (
    token: string,
    extinguisherId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/extinguishers/${extinguisherId}/services`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const postReturn = (
    token: string,
    orderId: string,
    payload: Record<string, unknown>,
    key: string = randomUUID(),
  ): request.Test =>
    request(server)
      .post(`/api/v1/maintenance-orders/${orderId}/return`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);

  const sendToMaintenance = async (
    token: string,
    created: AltaBody,
    overrides: Record<string, unknown> = {},
  ): Promise<OperationBody> => {
    const response = await postSend(
      token,
      created.id,
      sendPayload(created, overrides),
    ).expect(201);
    return response.body as OperationBody;
  };

  const storedAsset = (id: string) =>
    prisma.extinguisher.findUniqueOrThrow({ where: { id } });

  const dueDatesOf = (id: string) =>
    prisma.dueDate.findMany({
      where: { extinguisherId: id },
      orderBy: { eventType: 'asc' },
    });

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
    consultaToken = await authenticate(fixtures.consulta.email);

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
    const areaA = await createLocation('Área de producción', 'AREA');
    const workshopId = await createLocation('Taller propio', 'TALLER');

    const createProvider = async (
      code: string,
      name: string,
      active: boolean,
    ): Promise<string> => {
      const id = randomUUID();
      await prisma.externalParty.create({
        data: {
          id,
          code,
          name,
          partyType: 'PROVEEDOR_MANTENIMIENTO',
          active,
        },
      });
      return id;
    };

    const providerId = await createProvider(
      'PRV-0001',
      'Proveedor de mantenimiento',
      true,
    );
    const otherProviderId = await createProvider(
      'PRV-0002',
      'Proveedor alterno',
      true,
    );
    const inactiveProviderId = await createProvider(
      'PRV-0003',
      'Proveedor inactivo',
      false,
    );

    catalog = {
      typeId,
      warehouseA,
      areaA,
      workshopId,
      providerId,
      otherProviderId,
      inactiveProviderId,
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-MAN-01: el envío crea orden, movimiento y estado EN_MANTENIMIENTO', async () => {
    const created = await createExtinguisher();
    const body = await sendToMaintenance(almacenToken, created);

    expect(body.maintenanceOrder.status).toBe('EN_PROVEEDOR');
    expect(body.maintenanceOrder.provider?.id).toBe(catalog.providerId);
    expect(body.movement.type).toBe('ENVIO_MANTENIMIENTO');
    expect(body.movement.assetSequence).toBe(2);
    expect(body.extinguisher.logisticsStatus).toBe('EN_MANTENIMIENTO');
    expect(body.extinguisher.placementType).toBe('EXTERNAL');
    expect(body.extinguisher.currentExternalParty?.id).toBe(catalog.providerId);

    const storedOrder = await prisma.maintenanceOrder.findUniqueOrThrow({
      where: { id: body.maintenanceOrder.id },
    });
    expect(storedOrder.openedAt.toISOString()).toBe(body.movement.movedAt);
    expect(storedOrder.sentMovementId).toBe(body.movement.id);

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'MAINTENANCE_ORDER_CREATED',
        entityId: body.maintenanceOrder.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('T-MAN-02: rechaza un segundo envío con orden activa', async () => {
    const created = await createExtinguisher();
    const first = await sendToMaintenance(almacenToken, created);

    const response = await postSend(
      almacenToken,
      created.id,
      sendPayload(created, { rowVersion: first.extinguisher.rowVersion }),
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe(
      'MAINTENANCE_ORDER_ACTIVE',
    );
    expect(
      await prisma.maintenanceOrder.count({
        where: { extinguisherId: created.id },
      }),
    ).toBe(1);
    expect(
      await prisma.movement.count({
        where: {
          extinguisherId: created.id,
          movementType: 'ENVIO_MANTENIMIENTO',
        },
      }),
    ).toBe(1);
  });

  it('T-MAN-03: rechaza el envío a un proveedor inactivo', async () => {
    const created = await createExtinguisher();
    const response = await postSend(
      almacenToken,
      created.id,
      sendPayload(created, { providerId: catalog.inactiveProviderId }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('PROVIDER_INVALID');
    expect(
      await prisma.maintenanceOrder.count({
        where: { extinguisherId: created.id },
      }),
    ).toBe(0);
  });

  it('T-MAN-04: el retorno sin servicio responde 422 y no altera el activo', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    const response = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, sent.extinguisher.rowVersion),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe(
      'MAINTENANCE_SERVICE_REQUIRED',
    );
    const stored = await storedAsset(created.id);
    expect(stored.logisticsStatus).toBe('EN_MANTENIMIENTO');
    expect(stored.rowVersion).toBe(sent.extinguisher.rowVersion);
    const order = await prisma.maintenanceOrder.findUniqueOrThrow({
      where: { id: sent.maintenanceOrder.id },
    });
    expect(order.status).toBe('EN_PROVEEDOR');
    expect(order.returnMovementId).toBeNull();
  });

  it('T-MAN-05: un servicio RECARGA solo actualiza la categoría RECARGA', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        serviceType: 'RECARGA',
        nextDueDate: '2027-11-19',
      }),
    ).expect(201);

    const dueDates = await dueDatesOf(created.id);
    const recarga = dueDates.find((due) => due.eventType === 'RECARGA');
    expect(recarga?.dueDate.toISOString().slice(0, 10)).toBe('2027-11-19');
    expect(dueDates.some((due) => due.eventType === 'MANTENIMIENTO')).toBe(
      false,
    );
    expect(
      dueDates.some((due) => due.eventType === 'PRUEBA_HIDROSTATICA'),
    ).toBe(false);
  });

  it('T-MAN-06: un servicio sin próxima fecha elimina la categoría', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        performedAt: at(created, 60),
        nextDueDate: '2027-11-19',
      }),
    ).expect(201);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        performedAt: at(created, 120),
        nextDueDate: undefined,
      }),
    ).expect(201);

    const dueDates = await dueDatesOf(created.id);
    expect(dueDates.some((due) => due.eventType === 'MANTENIMIENTO')).toBe(
      false,
    );
  });

  it('T-MAN-07: un servicio retroactivo no reemplaza la fecha vigente', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    const later = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        performedAt: at(created, 120),
        nextDueDate: '2028-01-15',
      }),
    ).expect(201);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        performedAt: at(created, 60),
        nextDueDate: '2027-01-15',
      }),
    ).expect(201);

    const dueDates = await dueDatesOf(created.id);
    const maintenance = dueDates.find(
      (due) => due.eventType === 'MANTENIMIENTO',
    );
    expect(maintenance?.dueDate.toISOString().slice(0, 10)).toBe('2028-01-15');
    expect(maintenance?.sourceId).toBe((later.body as ServiceView).id);
  });

  it('T-MAN-08: un servicio posterior reemplaza la fecha objetivo', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        performedAt: at(created, 60),
        nextDueDate: '2027-01-15',
      }),
    ).expect(201);
    const later = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, {
        performedAt: at(created, 120),
        nextDueDate: '2028-01-15',
      }),
    ).expect(201);

    const dueDates = await dueDatesOf(created.id);
    const maintenance = dueDates.find(
      (due) => due.eventType === 'MANTENIMIENTO',
    );
    expect(maintenance?.dueDate.toISOString().slice(0, 10)).toBe('2028-01-15');
    expect(maintenance?.sourceId).toBe((later.body as ServiceView).id);
  });

  it('T-MAN-09: el retorno con servicio aprobado cierra la orden sin cambiar la condición', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { result: 'APROBADO' }),
    ).expect(201);

    const response = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, sent.extinguisher.rowVersion),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.maintenanceOrder.status).toBe('CERRADA');
    expect(body.maintenanceOrder.returnMovementId).toBe(body.movement.id);
    expect(body.movement.type).toBe('RETORNO_MANTENIMIENTO');
    expect(body.extinguisher.logisticsStatus).toBe('EN_ALMACEN');
    expect(body.extinguisher.technicalCondition).toBe('OPERATIVO');

    const order = await prisma.maintenanceOrder.findUniqueOrThrow({
      where: { id: sent.maintenanceOrder.id },
    });
    expect(order.closedAt?.toISOString()).toBe(body.movement.movedAt);
  });

  it('T-MAN-10: un resultado RECHAZADO no cambia la condición técnica', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { result: 'RECHAZADO' }),
    ).expect(201);

    const response = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, sent.extinguisher.rowVersion),
    ).expect(201);
    const body = response.body as OperationBody;

    expect(body.maintenanceOrder.status).toBe('CERRADA');
    expect(body.extinguisher.technicalCondition).toBe('OPERATIVO');
  });

  it('T-MAN-11: el retorno con proveedor distinto responde 409 y no cierra', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created),
    ).expect(201);
    await prisma.extinguisher.update({
      where: { id: created.id },
      data: { currentExternalPartyId: catalog.otherProviderId },
    });

    const response = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, sent.extinguisher.rowVersion),
    ).expect(409);

    expect((response.body as ErrorBody).error.code).toBe('ORIGIN_MISMATCH');
    const order = await prisma.maintenanceOrder.findUniqueOrThrow({
      where: { id: sent.maintenanceOrder.id },
    });
    expect(order.status).toBe('EN_PROVEEDOR');
    expect(order.returnMovementId).toBeNull();
  });

  it('T-MAN-12: rechaza un retorno anterior al último servicio', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { performedAt: at(created, 120) }),
    ).expect(201);

    const response = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, sent.extinguisher.rowVersion, {
        movedAt: at(created, 60),
      }),
    ).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('DATE_BEFORE_EVENT');
    const order = await prisma.maintenanceOrder.findUniqueOrThrow({
      where: { id: sent.maintenanceOrder.id },
    });
    expect(order.status).toBe('EN_PROVEEDOR');
  });

  it('T-MAN-13: un servicio interno sin orden actualiza fechas y audita', async () => {
    const created = await createExtinguisher();

    const response = await postStandaloneService(seguridadToken, created.id, {
      serviceType: 'MANTENIMIENTO',
      performedAt: at(created, 10),
      performedByUserId: fixtures.admin.id,
      result: 'APROBADO',
      nextDueDate: '2027-11-19',
      notes: 'Servicio interno de taller.',
    }).expect(201);
    const service = response.body as ServiceView;

    expect(service.maintenanceOrderId).toBeNull();
    expect(service.provider).toBeNull();
    expect(service.performedByUser?.id).toBe(fixtures.admin.id);

    const dueDates = await dueDatesOf(created.id);
    const maintenance = dueDates.find(
      (due) => due.eventType === 'MANTENIMIENTO',
    );
    expect(maintenance?.dueDate.toISOString().slice(0, 10)).toBe('2027-11-19');
    expect(maintenance?.sourceType).toBe('MAINTENANCE_SERVICE');

    const audit = await prisma.auditLog.findFirst({
      where: {
        action: 'MAINTENANCE_SERVICE_CREATED',
        entityId: service.id,
      },
    });
    expect(audit).not.toBeNull();
  });

  it('T-MAN-14: una orden cerrada rechaza servicios y retorno', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);
    await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created),
    ).expect(201);
    const closed = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, sent.extinguisher.rowVersion),
    ).expect(201);
    const closedBody = closed.body as OperationBody;

    const serviceResponse = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { performedAt: at(created, 180) }),
    ).expect(409);
    expect((serviceResponse.body as ErrorBody).error.code).toBe(
      'MAINTENANCE_ORDER_CLOSED',
    );

    const returnResponse = await postReturn(
      almacenToken,
      sent.maintenanceOrder.id,
      returnPayload(created, closedBody.extinguisher.rowVersion, {
        movedAt: at(created, 240),
      }),
    ).expect(409);
    expect((returnResponse.body as ErrorBody).error.code).toBe(
      'MAINTENANCE_ORDER_CLOSED',
    );
  });

  it('T-MAN-17: guarda y expone el costo y la moneda', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    const response = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { cost: 150, currency: 'PEN' }),
    ).expect(201);
    const service = response.body as ServiceView;
    expect(service.cost).toBe('150.00');
    expect(service.currency).toBe('PEN');

    const detail = await request(server)
      .get(`/api/v1/maintenance-orders/${sent.maintenanceOrder.id}`)
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    const services = (detail.body as { services: ServiceView[] }).services;
    expect(services).toHaveLength(1);
    expect(services[0]?.cost).toBe('150.00');
    expect(services[0]?.currency).toBe('PEN');
  });

  it('T-MAN-18: rechaza costo negativo o moneda de dos letras', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    const negative = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { cost: -5, currency: 'PEN' }),
    ).expect(422);
    expect((negative.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const shortCurrency = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { cost: 10, currency: 'PE' }),
    ).expect(422);
    expect((shortCurrency.body as ErrorBody).error.code).toBe(
      'VALIDATION_ERROR',
    );

    expect(
      await prisma.maintenanceService.count({
        where: { maintenanceOrderId: sent.maintenanceOrder.id },
      }),
    ).toBe(0);
  });

  it('T-MAN-19: exige coherencia entre costo y moneda', async () => {
    const created = await createExtinguisher();
    const sent = await sendToMaintenance(almacenToken, created);

    const noCurrency = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { cost: 10, currency: undefined }),
    ).expect(422);
    expect((noCurrency.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const noCost = await postOrderService(
      almacenToken,
      sent.maintenanceOrder.id,
      servicePayload(created, { cost: undefined, currency: 'PEN' }),
    ).expect(422);
    expect((noCost.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    expect(
      await prisma.maintenanceService.count({
        where: { maintenanceOrderId: sent.maintenanceOrder.id },
      }),
    ).toBe(0);
  });

  it('T-CON-02: dos envíos simultáneos dejan una sola orden activa', async () => {
    const created = await createExtinguisher();
    const payload = sendPayload(created);

    const [first, second] = await Promise.all([
      postSend(almacenToken, created.id, payload, randomUUID()),
      postSend(almacenToken, created.id, payload, randomUUID()),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 409]);
    expect(
      await prisma.maintenanceOrder.count({
        where: { extinguisherId: created.id },
      }),
    ).toBe(1);
    expect(
      await prisma.movement.count({
        where: {
          extinguisherId: created.id,
          movementType: 'ENVIO_MANTENIMIENTO',
        },
      }),
    ).toBe(1);
  });
});
