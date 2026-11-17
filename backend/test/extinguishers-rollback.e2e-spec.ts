import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthFixtures, TEST_PASSWORD, seedAuthFixtures } from './e2e-fixtures';
import { prisma, resetDatabase } from './integration/test-db';

interface ErrorBody {
  error: { code: string; message: string; requestId: string | null };
}

describe('Alta de extintor: rollback atómico (T-MOV-16 / T-MOV-17)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let token: string;
  let typeId: string;
  let warehouseId: string;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AuditService)
      .useValue({
        record: (entry: { action: string }) => {
          // Falla después de insertar el extintor, el movimiento y la fecha
          // objetivo, justo antes de confirmar la transacción.
          if (entry.action === 'EXTINGUISHER_CREATED') {
            throw new Error('fallo simulado de auditoría');
          }
          return Promise.resolve();
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        errorHttpStatusCode: 422,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();

    const login = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: fixtures.admin.email, password: TEST_PASSWORD })
      .expect(200);
    token = (login.body as { accessToken: string }).accessToken;

    typeId = randomUUID();
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
        name: 'Sede',
        type: 'SEDE',
        createdById: fixtures.admin.id,
      },
    });
    warehouseId = randomUUID();
    await prisma.location.create({
      data: {
        id: warehouseId,
        code: `UBI-${warehouseId.slice(0, 8)}`,
        name: 'Almacén',
        type: 'ALMACEN',
        parentId: sedeId,
        createdById: fixtures.admin.id,
      },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('no deja extintor, movimiento, fecha ni registro de idempotencia', async () => {
    const response = await request(server)
      .post('/api/v1/extinguishers')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        typeId,
        capacityValue: 6,
        capacityUnit: 'KG',
        manufactureDate: '2020-01-01',
        initialLocationId: warehouseId,
        entrySource: 'COMPRA_CENTRAL',
        initialReason: 'Compra central para el almacén',
        receivedBy: 'Carlos Ruiz',
        documentRef: 'FACTURA-001',
        technicalCondition: 'OPERATIVO',
      })
      .expect(500);

    expect((response.body as ErrorBody).error.code).toBe('INTERNAL_ERROR');
    expect(await prisma.extinguisher.count()).toBe(0);
    expect(await prisma.movement.count()).toBe(0);
    expect(await prisma.dueDate.count()).toBe(0);
    expect(await prisma.idempotencyRecord.count()).toBe(0);
  });
});
