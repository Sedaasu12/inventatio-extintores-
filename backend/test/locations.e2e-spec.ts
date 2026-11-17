import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { createTestApp } from './e2e-app';
import { AuthFixtures, TEST_PASSWORD, seedAuthFixtures } from './e2e-fixtures';
import {
  createBaseFixtures,
  createMovement,
  createOrder,
  prisma,
  resetDatabase,
} from './integration/test-db';

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string | null;
  };
}

interface LocationBody {
  id: string;
  code: string;
  name: string;
  type: 'SEDE' | 'ALMACEN' | 'AREA' | 'TALLER';
  parentId: string | null;
  active: boolean;
  children?: Array<{ id: string; name: string }>;
}

describe('Ubicaciones (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let adminToken: string;
  let consultaToken: string;

  const authenticate = async (email: string): Promise<string> => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return (response.body as { accessToken: string }).accessToken;
  };

  const createLocation = (
    token: string,
    body: Record<string, unknown>,
  ): request.Test =>
    request(server)
      .post('/api/v1/locations')
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
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-UBI-01: crea una SEDE y un AREA hija con código generado', async () => {
    const sedeResponse = await createLocation(adminToken, {
      name: 'Sede Central',
      type: 'SEDE',
      address: 'Av. Principal 100',
    }).expect(201);
    const sede = sedeResponse.body as LocationBody;

    expect(sede.code).toMatch(/^UBI-\d{6}$/);
    expect(sede.parentId).toBeNull();
    expect(sede.active).toBe(true);

    const areaResponse = await createLocation(adminToken, {
      name: 'Área de producción',
      type: 'AREA',
      parentId: sede.id,
    }).expect(201);
    const area = areaResponse.body as LocationBody;

    expect(area.code).toMatch(/^UBI-\d{6}$/);
    expect(area.code).not.toBe(sede.code);
    expect(area.parentId).toBe(sede.id);

    const detail = await request(server)
      .get(`/api/v1/locations/${sede.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const detailBody = detail.body as LocationBody;
    expect(detailBody.children?.map((child) => child.id)).toContain(area.id);
  });

  it('T-UBI-02: el cliente no puede enviar el código', async () => {
    const response = await createLocation(adminToken, {
      name: 'Sede con código',
      type: 'SEDE',
      code: 'UBI-999999',
    }).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    expect(await prisma.location.count()).toBe(0);
  });

  it('T-UBI-03: un área no puede ser padre de otra área (LOCATION_DEPTH)', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;
    const area = (
      await createLocation(adminToken, {
        name: 'Área',
        type: 'AREA',
        parentId: sede.id,
      }).expect(201)
    ).body as LocationBody;

    const response = await createLocation(adminToken, {
      name: 'Subárea',
      type: 'AREA',
      parentId: area.id,
    }).expect(422);

    expect((response.body as ErrorBody).error.code).toBe('LOCATION_DEPTH');
    expect(await prisma.location.count()).toBe(2);
  });

  it('T-UBI-04: no desactiva una ubicación con extintores ni una sede con hijos activos', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;
    const warehouse = (
      await createLocation(adminToken, {
        name: 'Almacén',
        type: 'ALMACEN',
        parentId: sede.id,
      }).expect(201)
    ).body as LocationBody;

    const typeId = randomUUID();
    await prisma.extinguisherType.create({
      data: {
        id: typeId,
        code: `TIPO-${typeId.slice(0, 8)}`,
        name: 'Tipo de prueba',
        agent: 'PQS',
        nominalCapacity: '6.00',
        capacityUnit: 'KG',
      },
    });
    await prisma.extinguisher.create({
      data: {
        id: randomUUID(),
        assetCode: `EXT-${randomUUID().slice(0, 8).toUpperCase()}`,
        typeId,
        capacityValue: '6.00',
        capacityUnit: 'KG',
        logisticsStatus: 'EN_ALMACEN',
        technicalCondition: 'OPERATIVO',
        placementType: 'INTERNAL',
        currentLocationId: warehouse.id,
        createdById: fixtures.admin.id,
      },
    });

    const withAssets = await request(server)
      .post(`/api/v1/locations/${warehouse.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect((withAssets.body as ErrorBody).error.code).toBe('CONFLICT');

    const sedeWithChildren = await request(server)
      .post(`/api/v1/locations/${sede.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);
    expect((sedeWithChildren.body as ErrorBody).error.code).toBe('CONFLICT');

    const stillActive = await prisma.location.findUniqueOrThrow({
      where: { id: warehouse.id },
    });
    expect(stillActive.active).toBe(true);
  });

  it('T-UBI-06: código duplicado de tipo o contraparte devuelve 409', async () => {
    await request(server)
      .post('/api/v1/extinguisher-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PQS-6KG',
        name: 'PQS 6 kg',
        agent: 'PQS',
        nominalCapacity: 6,
        capacityUnit: 'KG',
      })
      .expect(201);

    const duplicateType = await request(server)
      .post('/api/v1/extinguisher-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PQS-6KG',
        name: 'Otro PQS',
        agent: 'PQS',
        nominalCapacity: 6,
        capacityUnit: 'KG',
      })
      .expect(409);
    expect((duplicateType.body as ErrorBody).error.code).toBe('CONFLICT');

    await request(server)
      .post('/api/v1/external-parties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PRV-001',
        name: 'Proveedor Uno',
        partyType: 'PROVEEDOR_MANTENIMIENTO',
      })
      .expect(201);

    const duplicateParty = await request(server)
      .post('/api/v1/external-parties')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'PRV-001',
        name: 'Proveedor Dos',
        partyType: 'PROVEEDOR',
      })
      .expect(409);
    expect((duplicateParty.body as ErrorBody).error.code).toBe('CONFLICT');
  });

  it('T-UBI-08: ALMACEN, TALLER o AREA exigen parentId', async () => {
    for (const type of ['ALMACEN', 'TALLER', 'AREA'] as const) {
      const response = await createLocation(adminToken, {
        name: `Sin padre ${type}`,
        type,
      }).expect(422);
      expect((response.body as ErrorBody).error.code).toBe(
        'LOCATION_PARENT_TYPE',
      );
    }
    expect(await prisma.location.count()).toBe(0);
  });

  it('T-UBI-09: una SEDE no admite parentId', async () => {
    const sede = (
      await createLocation(adminToken, {
        name: 'Sede raíz',
        type: 'SEDE',
      }).expect(201)
    ).body as LocationBody;

    const response = await createLocation(adminToken, {
      name: 'Sede hija',
      type: 'SEDE',
      parentId: sede.id,
    }).expect(422);

    expect((response.body as ErrorBody).error.code).toBe(
      'LOCATION_PARENT_TYPE',
    );
    expect(await prisma.location.count()).toBe(1);
  });

  it('T-UBI-10: nombre repetido en la misma sede devuelve 409', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;
    await createLocation(adminToken, {
      name: 'Almacén Central',
      type: 'ALMACEN',
      parentId: sede.id,
    }).expect(201);

    const response = await createLocation(adminToken, {
      name: 'Almacén Central',
      type: 'TALLER',
      parentId: sede.id,
    }).expect(409);

    expect((response.body as ErrorBody).error.code).toBe(
      'LOCATION_NAME_DUPLICATE',
    );
    expect(await prisma.location.count()).toBe(2);
  });

  it('T-UBI-11: el mismo nombre en sedes distintas se permite', async () => {
    const first = (
      await createLocation(adminToken, {
        name: 'Sede Norte',
        type: 'SEDE',
      }).expect(201)
    ).body as LocationBody;
    const second = (
      await createLocation(adminToken, {
        name: 'Sede Sur',
        type: 'SEDE',
      }).expect(201)
    ).body as LocationBody;

    await createLocation(adminToken, {
      name: 'Almacén Principal',
      type: 'ALMACEN',
      parentId: first.id,
    }).expect(201);
    await createLocation(adminToken, {
      name: 'Almacén Principal',
      type: 'ALMACEN',
      parentId: second.id,
    }).expect(201);

    expect(await prisma.location.count()).toBe(4);
  });

  it('T-UBI-12: el código es inmutable y no se acepta en PATCH', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;

    const response = await request(server)
      .patch(`/api/v1/locations/${sede.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: 'UBI-000999' })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');

    const unchanged = await prisma.location.findUniqueOrThrow({
      where: { id: sede.id },
    });
    expect(unchanged.code).toBe(sede.code);
  });

  it('desactiva una ubicación vacía y audita el cambio', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;
    const warehouse = (
      await createLocation(adminToken, {
        name: 'Almacén',
        type: 'ALMACEN',
        parentId: sede.id,
      }).expect(201)
    ).body as LocationBody;

    await request(server)
      .post(`/api/v1/locations/${warehouse.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
    await request(server)
      .post(`/api/v1/locations/${sede.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const inactive = await prisma.location.findMany({
      where: { active: false },
    });
    expect(inactive).toHaveLength(2);

    const audit = await prisma.auditLog.findMany({
      where: { action: 'LOCATION_DEACTIVATED' },
    });
    expect(audit).toHaveLength(2);
    expect(audit.map((row) => row.entityId)).toEqual(
      expect.arrayContaining([sede.id, warehouse.id]),
    );
  });

  it('rechaza un padre inactivo y un padre inexistente', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;
    await request(server)
      .post(`/api/v1/locations/${sede.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    const inactiveParent = await createLocation(adminToken, {
      name: 'Almacén',
      type: 'ALMACEN',
      parentId: sede.id,
    }).expect(422);
    expect((inactiveParent.body as ErrorBody).error.code).toBe(
      'LOCATION_PARENT_TYPE',
    );

    const missingParent = await createLocation(adminToken, {
      name: 'Taller',
      type: 'TALLER',
      parentId: randomUUID(),
    }).expect(422);
    expect((missingParent.body as ErrorBody).error.code).toBe(
      'LOCATION_PARENT_TYPE',
    );
  });

  it('lista de forma paginada y devuelve el árbol de sedes', async () => {
    const north = (
      await createLocation(adminToken, {
        name: 'Sede Norte',
        type: 'SEDE',
      }).expect(201)
    ).body as LocationBody;
    await createLocation(adminToken, { name: 'Sede Sur', type: 'SEDE' }).expect(
      201,
    );
    await createLocation(adminToken, {
      name: 'Almacén Norte',
      type: 'ALMACEN',
      parentId: north.id,
    }).expect(201);

    const list = await request(server)
      .get('/api/v1/locations?page=1&pageSize=2&type=SEDE')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const listBody = list.body as {
      data: LocationBody[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    expect(listBody.data).toHaveLength(2);
    expect(listBody.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 2,
      totalPages: 1,
    });

    const tree = await request(server)
      .get('/api/v1/locations?tree=true')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const treeBody = tree.body as { data: LocationBody[] };
    expect(treeBody.data).toHaveLength(2);
    const northNode = treeBody.data.find((node) => node.id === north.id);
    expect(northNode?.children).toHaveLength(1);
    expect(northNode?.children?.[0]?.name).toBe('Almacén Norte');
  });

  it('incluye el inventario de los hijos al consultar una sede', async () => {
    const sede = (
      await createLocation(adminToken, { name: 'Sede', type: 'SEDE' }).expect(
        201,
      )
    ).body as LocationBody;
    const area = (
      await createLocation(adminToken, {
        name: 'Área',
        type: 'AREA',
        parentId: sede.id,
      }).expect(201)
    ).body as LocationBody;

    const typeId = randomUUID();
    await prisma.extinguisherType.create({
      data: {
        id: typeId,
        code: `TIPO-${typeId.slice(0, 8)}`,
        name: 'Tipo de prueba',
        agent: 'PQS',
        nominalCapacity: '6.00',
        capacityUnit: 'KG',
      },
    });
    const extinguisherId = randomUUID();
    await prisma.extinguisher.create({
      data: {
        id: extinguisherId,
        assetCode: `EXT-${extinguisherId.slice(0, 8).toUpperCase()}`,
        typeId,
        capacityValue: '6.00',
        capacityUnit: 'KG',
        logisticsStatus: 'ASIGNADO',
        technicalCondition: 'OPERATIVO',
        placementType: 'INTERNAL',
        currentLocationId: area.id,
        createdById: fixtures.admin.id,
      },
    });

    const response = await request(server)
      .get(`/api/v1/locations/${sede.id}/extinguishers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const body = response.body as {
      data: Array<{ id: string; assetCode: string }>;
      meta: { total: number };
    };
    expect(body.meta.total).toBe(1);
    expect(body.data[0]?.id).toBe(extinguisherId);
  });

  it('no desactiva un taller con una orden de mantenimiento activa', async () => {
    const base = await createBaseFixtures();
    const movementId = await createMovement(base, {
      destinationLocationId: base.workshopId,
    });
    await createOrder(base, {
      providerId: null,
      workshopLocationId: base.workshopId,
      sentMovementId: movementId,
      status: 'ABIERTA',
    });

    const response = await request(server)
      .post(`/api/v1/locations/${base.workshopId}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    expect((response.body as ErrorBody).error.code).toBe('CONFLICT');
    const workshop = await prisma.location.findUniqueOrThrow({
      where: { id: base.workshopId },
    });
    expect(workshop.active).toBe(true);
  });

  it('edita nombre y dirección y cambia el padre si no hay historial', async () => {
    const first = (
      await createLocation(adminToken, {
        name: 'Sede Uno',
        type: 'SEDE',
      }).expect(201)
    ).body as LocationBody;
    const second = (
      await createLocation(adminToken, {
        name: 'Sede Dos',
        type: 'SEDE',
      }).expect(201)
    ).body as LocationBody;
    const area = (
      await createLocation(adminToken, {
        name: 'Área Uno',
        type: 'AREA',
        parentId: first.id,
      }).expect(201)
    ).body as LocationBody;

    const updated = await request(server)
      .patch(`/api/v1/locations/${area.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Área Renombrada',
        address: 'Piso 2',
        parentId: second.id,
      })
      .expect(200);
    const body = updated.body as LocationBody & { address: string | null };
    expect(body.name).toBe('Área Renombrada');
    expect(body.address).toBe('Piso 2');
    expect(body.parentId).toBe(second.id);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'LOCATION_UPDATED', entityId: area.id },
    });
    expect(JSON.stringify(audit.beforeData)).toContain(first.id);
    expect(JSON.stringify(audit.afterData)).toContain(second.id);
  });

  it('devuelve 404 para una ubicación inexistente y 403 sin permiso de gestión', async () => {
    const missing = randomUUID();

    await request(server)
      .get(`/api/v1/locations/${missing}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
    await request(server)
      .patch(`/api/v1/locations/${missing}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Nueva' })
      .expect(404);
    await request(server)
      .post(`/api/v1/locations/${missing}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    await createLocation(consultaToken, { name: 'Sede', type: 'SEDE' }).expect(
      403,
    );
  });
});
