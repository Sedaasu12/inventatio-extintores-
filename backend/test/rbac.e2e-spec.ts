import { INestApplication } from '@nestjs/common';
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

interface Session {
  accessToken: string;
}

describe('RBAC y auditoría (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let admin: Session;
  let consulta: Session;
  let almacen: Session;

  const authenticate = async (email: string): Promise<Session> => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    return response.body as Session;
  };

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    admin = await authenticate(fixtures.admin.email);
    consulta = await authenticate(fixtures.consulta.email);
    almacen = await authenticate(fixtures.almacen.email);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('responde 401 con el contrato de error y requestId en cabecera', async () => {
    const response = await request(server)
      .get('/api/v1/users')
      .set('X-Request-Id', 'peticion-de-prueba-001')
      .expect(401);

    const body = response.body as ErrorBody;
    expect(body.error.code).toBe('UNAUTHENTICATED');
    expect(body.error.requestId).toBe('peticion-de-prueba-001');
    expect(response.headers['x-request-id']).toBe('peticion-de-prueba-001');
    expect(JSON.stringify(body)).not.toContain('at ');
  });

  it('CONSULTA no puede listar usuarios (403)', async () => {
    const response = await request(server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${consulta.accessToken}`)
      .expect(403);

    expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
  });

  it('ALMACEN no puede crear usuarios ni modificar permisos (403)', async () => {
    const before = await prisma.user.count();

    await request(server)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${almacen.accessToken}`)
      .send({
        email: 'intruso@test.local',
        fullName: 'Intruso',
        roleCodes: ['ADMIN'],
      })
      .expect(403);

    expect(await prisma.user.count()).toBe(before);
    expect(
      await prisma.user.count({ where: { email: 'intruso@test.local' } }),
    ).toBe(0);

    const role = await prisma.role.findFirstOrThrow({
      where: { code: 'CONSULTA' },
    });
    await request(server)
      .put(`/api/v1/roles/${role.id}/permissions`)
      .set('Authorization', `Bearer ${almacen.accessToken}`)
      .send({ permissionCodes: ['users.manage'] })
      .expect(403);
  });

  it('ADMIN lista usuarios con paginación del servidor', async () => {
    const response = await request(server)
      .get('/api/v1/users?page=1&pageSize=2')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const body = response.body as {
      data: unknown[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
      };
    };
    expect(body.data).toHaveLength(2);
    expect(body.meta).toMatchObject({
      page: 1,
      pageSize: 2,
      total: 4,
      totalPages: 2,
    });
  });

  it('ADMIN consulta permisos y reemplaza los de un rol con auditoría', async () => {
    const permissions = await request(server)
      .get('/api/v1/permissions')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect((permissions.body as unknown[]).length).toBeGreaterThan(0);

    const role = await prisma.role.findFirstOrThrow({
      where: { code: 'CONSULTA' },
    });

    const updated = await request(server)
      .put(`/api/v1/roles/${role.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ permissionCodes: ['extinguishers.read', 'users.read'] })
      .expect(200);

    expect((updated.body as { permissions: string[] }).permissions).toEqual([
      'extinguishers.read',
      'users.read',
    ]);

    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'ROLE_PERMISSIONS_UPDATED' },
    });
    expect(audit.entityId).toBe(role.id);
    expect(JSON.stringify(audit.beforeData)).toContain('extinguishers.read');
  });

  it('rechaza permisos inexistentes con 422', async () => {
    const role = await prisma.role.findFirstOrThrow({
      where: { code: 'CONSULTA' },
    });

    const response = await request(server)
      .put(`/api/v1/roles/${role.id}/permissions`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ permissionCodes: ['permiso.inexistente'] })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('UNKNOWN_PERMISSION');
  });

  it('valida DTOs en el servidor con 422 y detalles', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ email: 'no-es-un-correo', roleCodes: [] })
      .expect(422);

    const body = response.body as ErrorBody;
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('solo audit.read puede consultar la auditoría', async () => {
    await request(server)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${consulta.accessToken}`)
      .expect(403);

    const response = await request(server)
      .get('/api/v1/audit-logs?page=1&pageSize=10')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);

    const body = response.body as {
      data: Array<{ action: string; afterData: unknown }>;
      meta: { total: number };
    };
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.data.map((row) => row.action)).toContain(
      'AUTH_LOGIN_SUCCEEDED',
    );

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(TEST_PASSWORD);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('refreshToken');
  });
});
