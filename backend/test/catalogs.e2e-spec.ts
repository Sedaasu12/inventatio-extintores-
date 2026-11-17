import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
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

interface TypeBody {
  id: string;
  code: string;
  name: string;
  agent: string;
  nominalCapacity: string;
  capacityUnit: string;
  usefulLifeYears: number | null;
  active: boolean;
  extinguisherCount: number;
}

interface PartyBody {
  id: string;
  code: string;
  name: string;
  partyType: string;
  active: boolean;
}

describe('Catálogos (e2e)', () => {
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

  const createType = (body: Record<string, unknown>): request.Test =>
    request(server)
      .post('/api/v1/extinguisher-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

  const createParty = (body: Record<string, unknown>): request.Test =>
    request(server)
      .post('/api/v1/external-parties')
      .set('Authorization', `Bearer ${adminToken}`)
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

  describe('Tipos de extintor', () => {
    it('crea, lista y edita un tipo', async () => {
      const created = await createType({
        code: 'PQS-6KG',
        name: 'PQS 6 kg',
        agent: 'PQS',
        nominalCapacity: 6,
        capacityUnit: 'KG',
        usefulLifeYears: 10,
        description: 'Polvo químico seco',
      }).expect(201);
      const type = created.body as TypeBody;

      expect(type.code).toBe('PQS-6KG');
      expect(type.nominalCapacity).toBe('6.00');
      expect(type.usefulLifeYears).toBe(10);

      const list = await request(server)
        .get('/api/v1/extinguisher-types?page=1&pageSize=10&search=PQS')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const listBody = list.body as {
        data: TypeBody[];
        meta: { total: number };
      };
      expect(listBody.meta.total).toBe(1);
      expect(listBody.data[0]?.id).toBe(type.id);

      const updated = await request(server)
        .patch(`/api/v1/extinguisher-types/${type.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'PQS 6 kg actualizado', usefulLifeYears: 12 })
        .expect(200);
      const updatedBody = updated.body as TypeBody;
      expect(updatedBody.name).toBe('PQS 6 kg actualizado');
      expect(updatedBody.usefulLifeYears).toBe(12);

      const audit = await prisma.auditLog.findMany({
        where: {
          entityType: 'EXTINGUISHER_TYPE',
          action: 'EXTINGUISHER_TYPE_UPDATED',
        },
      });
      expect(audit).toHaveLength(1);
      expect(JSON.stringify(audit[0]?.afterData)).toContain(
        'equipmentDueDatesRecalculated',
      );
    });

    it('rechaza un código duplicado con 409', async () => {
      const payload = {
        code: 'CO2-5KG',
        name: 'CO2 5 kg',
        agent: 'CO2',
        nominalCapacity: 5,
        capacityUnit: 'KG',
      };
      await createType(payload).expect(201);

      const response = await createType({
        ...payload,
        name: 'CO2 duplicado',
      }).expect(409);
      expect((response.body as ErrorBody).error.code).toBe('CONFLICT');
    });

    it('rechaza una vida útil no entera o fuera de rango', async () => {
      const base = {
        code: 'ABC-1KG',
        name: 'ABC 1 kg',
        agent: 'ABC',
        nominalCapacity: 1,
        capacityUnit: 'KG',
      };

      for (const usefulLifeYears of [0, -1, 70000]) {
        const response = await createType({
          ...base,
          usefulLifeYears,
        }).expect(422);
        expect((response.body as ErrorBody).error.code).toBe(
          'USEFUL_LIFE_INVALID',
        );
      }

      const nonInteger = await createType({
        ...base,
        usefulLifeYears: 1.5,
      }).expect(422);
      expect((nonInteger.body as ErrorBody).error.code).toBe(
        'VALIDATION_ERROR',
      );

      expect(await prisma.extinguisherType.count()).toBe(0);
    });

    it('recalcula las fechas EQUIPO al cambiar la vida útil (D-12 / BR-107E)', async () => {
      const type = (
        await createType({
          code: 'PQS-9KG',
          name: 'PQS 9 kg',
          agent: 'PQS',
          nominalCapacity: 9,
          capacityUnit: 'KG',
          usefulLifeYears: 10,
        }).expect(201)
      ).body as TypeBody;

      const sedeId = randomUUID();
      await prisma.location.create({
        data: {
          id: sedeId,
          code: `UBI-${sedeId.slice(0, 8)}`,
          name: 'Sede de catálogos',
          type: 'SEDE',
          createdById: fixtures.admin.id,
        },
      });
      const warehouseId = randomUUID();
      await prisma.location.create({
        data: {
          id: warehouseId,
          code: `UBI-${warehouseId.slice(0, 8)}`,
          name: 'Almacén de catálogos',
          type: 'ALMACEN',
          parentId: sedeId,
          createdById: fixtures.admin.id,
        },
      });

      const calculatedOnlyId = randomUUID();
      await prisma.extinguisher.create({
        data: {
          id: calculatedOnlyId,
          assetCode: `EXT-${calculatedOnlyId.slice(0, 8).toUpperCase()}`,
          typeId: type.id,
          capacityValue: '9.00',
          capacityUnit: 'KG',
          manufactureDate: new Date('2020-01-01T00:00:00.000Z'),
          logisticsStatus: 'EN_ALMACEN',
          technicalCondition: 'OPERATIVO',
          placementType: 'INTERNAL',
          currentLocationId: warehouseId,
          createdById: fixtures.admin.id,
        },
      });

      const documentedId = randomUUID();
      await prisma.extinguisher.create({
        data: {
          id: documentedId,
          assetCode: `EXT-${documentedId.slice(0, 8).toUpperCase()}`,
          typeId: type.id,
          capacityValue: '9.00',
          capacityUnit: 'KG',
          manufactureDate: new Date('2020-01-01T00:00:00.000Z'),
          manufacturerExpiryDate: new Date('2022-06-01T00:00:00.000Z'),
          logisticsStatus: 'EN_ALMACEN',
          technicalCondition: 'OPERATIVO',
          placementType: 'INTERNAL',
          currentLocationId: warehouseId,
          createdById: fixtures.admin.id,
        },
      });

      await request(server)
        .patch(`/api/v1/extinguisher-types/${type.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usefulLifeYears: 5 })
        .expect(200);

      const calculated = await prisma.dueDate.findUniqueOrThrow({
        where: {
          extinguisherId_eventType: {
            extinguisherId: calculatedOnlyId,
            eventType: 'EQUIPO',
          },
        },
      });
      expect(calculated.dueDate.toISOString()).toBe('2025-01-01T00:00:00.000Z');
      expect(calculated.sourceType).toBe('EXTINGUISHER');
      expect(calculated.sourceId).toBe(calculatedOnlyId);

      const documented = await prisma.dueDate.findUniqueOrThrow({
        where: {
          extinguisherId_eventType: {
            extinguisherId: documentedId,
            eventType: 'EQUIPO',
          },
        },
      });
      expect(documented.dueDate.toISOString()).toBe('2022-06-01T00:00:00.000Z');

      // Quitar la vida útil borra solo las fechas calculables; la documentada
      // por el fabricante se conserva.
      await request(server)
        .patch(`/api/v1/extinguisher-types/${type.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ usefulLifeYears: null })
        .expect(200);

      expect(
        await prisma.dueDate.count({
          where: { extinguisherId: calculatedOnlyId, eventType: 'EQUIPO' },
        }),
      ).toBe(0);
      expect(
        await prisma.dueDate.count({
          where: { extinguisherId: documentedId, eventType: 'EQUIPO' },
        }),
      ).toBe(1);
    });

    it('devuelve 404 para un tipo inexistente', async () => {
      const missing = randomUUID();
      await request(server)
        .patch(`/api/v1/extinguisher-types/${missing}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No existe' })
        .expect(404);
      await request(server)
        .get(`/api/v1/external-parties/${missing}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('Contrapartes externas', () => {
    it('crea, lista, edita y desactiva una contraparte', async () => {
      const created = await createParty({
        code: 'PRV-001',
        name: 'Proveedor Uno',
        partyType: 'PROVEEDOR_MANTENIMIENTO',
        contactName: 'Ana Pérez',
        phone: '999888777',
      }).expect(201);
      const party = created.body as PartyBody;
      expect(party.code).toBe('PRV-001');
      expect(party.active).toBe(true);

      const list = await request(server)
        .get('/api/v1/external-parties?partyType=PROVEEDOR_MANTENIMIENTO')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const listBody = list.body as {
        data: PartyBody[];
        meta: { total: number };
      };
      expect(listBody.meta.total).toBe(1);
      expect(listBody.data[0]?.id).toBe(party.id);

      const updated = await request(server)
        .patch(`/api/v1/external-parties/${party.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Proveedor Uno S.A.C.', active: false })
        .expect(200);
      const updatedBody = updated.body as PartyBody;
      expect(updatedBody.name).toBe('Proveedor Uno S.A.C.');
      expect(updatedBody.active).toBe(false);

      const inactive = await request(server)
        .get('/api/v1/external-parties?active=false')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect((inactive.body as { meta: { total: number } }).meta.total).toBe(1);

      const audit = await prisma.auditLog.findMany({
        where: { entityType: 'EXTERNAL_PARTY' },
      });
      expect(audit.map((row) => row.action)).toEqual(
        expect.arrayContaining([
          'EXTERNAL_PARTY_CREATED',
          'EXTERNAL_PARTY_UPDATED',
        ]),
      );
    });

    it('rechaza un código duplicado con 409', async () => {
      await createParty({
        code: 'TAL-001',
        name: 'Taller Uno',
        partyType: 'TALLER',
      }).expect(201);

      const response = await createParty({
        code: 'TAL-001',
        name: 'Taller Dos',
        partyType: 'TALLER',
      }).expect(409);
      expect((response.body as ErrorBody).error.code).toBe('CONFLICT');
    });

    it('valida el DTO en el servidor', async () => {
      const response = await createParty({
        code: 'X',
        name: 'Y',
        partyType: 'NO_EXISTE',
        active: 'sí',
      }).expect(422);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });
  });

  it('solo catalogs.manage permite escribir; consulta puede leer', async () => {
    await request(server)
      .post('/api/v1/extinguisher-types')
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({
        code: 'PQS-1KG',
        name: 'PQS 1 kg',
        agent: 'PQS',
        nominalCapacity: 1,
        capacityUnit: 'KG',
      })
      .expect(403);

    await request(server)
      .post('/api/v1/external-parties')
      .set('Authorization', `Bearer ${consultaToken}`)
      .send({
        code: 'PRV-002',
        name: 'Proveedor Dos',
        partyType: 'PROVEEDOR',
      })
      .expect(403);

    await request(server)
      .get('/api/v1/extinguisher-types')
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
    await request(server)
      .get('/api/v1/external-parties')
      .set('Authorization', `Bearer ${consultaToken}`)
      .expect(200);
  });

  it('ignora campos de auditoría enviados por el cliente', async () => {
    const response = await createType({
      code: 'PQS-2KG',
      name: 'PQS 2 kg',
      agent: 'PQS',
      nominalCapacity: 2,
      capacityUnit: 'KG',
      createdBy: 'usuario-falso',
      createdAt: '2020-01-01',
    }).expect(422);
    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });
});
