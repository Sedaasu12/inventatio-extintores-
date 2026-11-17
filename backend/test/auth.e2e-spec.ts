import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRounds } from 'bcryptjs';
import { createHash } from 'node:crypto';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  AUTH_PROVIDER,
  type AuthIdentity,
} from '../src/modules/auth/auth-provider';
import { LoginRateLimiter } from '../src/modules/auth/login-rate-limiter';
import { createTestApp } from './e2e-app';
import {
  AuthFixtures,
  TEST_NEW_PASSWORD,
  extractRefreshCookie,
  seedAuthFixtures,
} from './e2e-fixtures';
import { prisma, resetDatabase } from './integration/test-db';

interface LoginBody {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    permissions: string[];
    mustChangePassword: boolean;
  };
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string | null;
  };
}

describe('Autenticación (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;

  const login = (email: string, password: string) =>
    request(server).post('/api/v1/auth/login').send({ email, password });

  const refresh = (cookie: string | undefined) => {
    const call = request(server).post('/api/v1/auth/refresh');
    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  const setCookies = (response: request.Response): string[] =>
    (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    app.get(LoginRateLimiter).reset();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('T-AUT-01: login válido devuelve access token, permisos y cookie HttpOnly', async () => {
    const response = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);
    const body = response.body as LoginBody;

    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.expiresIn).toBe(900);
    expect(body.user.permissions).toEqual(
      expect.arrayContaining(['users.read', 'users.manage', 'audit.read']),
    );

    const cookie = extractRefreshCookie(setCookies(response));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/api/v1/auth');
  });

  it('T-AUT-02: credenciales inválidas dan 401 genérico y auditoría de fallo', async () => {
    const wrongPassword = await login(
      fixtures.admin.email,
      'ContraseñaIncorrecta#1',
    ).expect(401);
    const unknownEmail = await login(
      'nadie@test.local',
      'ContraseñaIncorrecta#1',
    ).expect(401);

    const first = wrongPassword.body as ErrorBody;
    const second = unknownEmail.body as ErrorBody;
    expect(first.error.code).toBe('INVALID_CREDENTIALS');
    expect(first.error.message).toBe(second.error.message);

    const failures = await prisma.auditLog.findMany({
      where: { action: 'AUTH_LOGIN_FAILED' },
    });
    expect(failures).toHaveLength(2);
    const serialized = JSON.stringify(failures);
    expect(serialized).not.toContain('ContraseñaIncorrecta#1');
    expect(serialized).not.toContain('password');
  });

  it('T-AUT-03: un usuario inactivo no puede iniciar sesión', async () => {
    const response = await login(
      fixtures.inactive.email,
      fixtures.password,
    ).expect(401);

    expect((response.body as ErrorBody).error.code).toBe('INVALID_CREDENTIALS');
    expect(setCookies(response)).toHaveLength(0);
    expect(await prisma.refreshToken.count()).toBe(0);
  });

  it('valida el DTO de login con 422 antes de tocar la base', async () => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'no-es-un-correo' })
      .expect(422);

    expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
  });

  it('T-AUT-04: refresh rota el token y revoca el anterior', async () => {
    const first = await login(fixtures.admin.email, fixtures.password).expect(
      200,
    );
    const firstCookie = extractRefreshCookie(setCookies(first));

    const second = await refresh(firstCookie).expect(200);
    const secondCookie = extractRefreshCookie(setCookies(second));

    expect(secondCookie).toBeDefined();
    expect(secondCookie).not.toBe(firstCookie);

    const oldToken = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashOf(firstCookie) },
    });
    expect(oldToken?.revokedAt).not.toBeNull();

    await refresh(secondCookie).expect(200);
  });

  it('T-AUT-05: reutilizar un refresh rotado revoca la familia completa', async () => {
    const first = await login(fixtures.admin.email, fixtures.password).expect(
      200,
    );
    const firstCookie = extractRefreshCookie(setCookies(first));
    const second = await refresh(firstCookie).expect(200);
    const secondCookie = extractRefreshCookie(setCookies(second));

    await refresh(firstCookie).expect(401);
    await refresh(secondCookie).expect(401);

    const active = await prisma.refreshToken.count({
      where: { revokedAt: null },
    });
    expect(active).toBe(0);
  });

  it('T-AUT-06: logout revoca la sesión y el access token deja de valer', async () => {
    const loginResponse = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);
    const { accessToken } = loginResponse.body as LoginBody;

    await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);

    expect(
      await prisma.refreshToken.count({ where: { revokedAt: null } }),
    ).toBe(0);
  });

  it('T-AUT-08: el sexto intento fallido responde 429 con Retry-After', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await login(fixtures.consulta.email, 'ClaveIncorrecta#1').expect(401);
    }

    const response = await login(
      fixtures.consulta.email,
      'ClaveIncorrecta#1',
    ).expect(429);

    expect((response.body as ErrorBody).error.code).toBe('RATE_LIMITED');
    expect(response.headers['retry-after']).toBeDefined();
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('T-AUT-10: cambiar contraseña revoca otras sesiones y deja auditoría', async () => {
    const sessionOne = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);
    const sessionTwo = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);

    await request(server)
      .post('/api/v1/auth/change-password')
      .set(
        'Authorization',
        `Bearer ${(sessionOne.body as LoginBody).accessToken}`,
      )
      .send({
        currentPassword: fixtures.password,
        newPassword: TEST_NEW_PASSWORD,
      })
      .expect(204);

    await request(server)
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${(sessionTwo.body as LoginBody).accessToken}`,
      )
      .expect(401);

    await request(server)
      .get('/api/v1/auth/me')
      .set(
        'Authorization',
        `Bearer ${(sessionOne.body as LoginBody).accessToken}`,
      )
      .expect(200);

    await login(fixtures.admin.email, fixtures.password).expect(401);
    await login(fixtures.admin.email, TEST_NEW_PASSWORD).expect(200);

    expect(
      await prisma.auditLog.count({
        where: { action: 'AUTH_PASSWORD_CHANGED' },
      }),
    ).toBe(1);
  });

  it('T-AUT-12: sin sesión no se puede crear un usuario', async () => {
    const response = await request(server)
      .post('/api/v1/users')
      .send({
        email: 'nuevo@test.local',
        fullName: 'Nuevo',
        roleCodes: ['CONSULTA'],
      })
      .expect(401);

    expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    expect(
      await prisma.user.count({ where: { email: 'nuevo@test.local' } }),
    ).toBe(0);
  });

  it('T-AUT-13: un usuario desactivado pierde el acceso con token vigente', async () => {
    const session = await login(
      fixtures.consulta.email,
      fixtures.password,
    ).expect(200);

    await prisma.user.update({
      where: { id: fixtures.consulta.id },
      data: { active: false },
    });

    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${(session.body as LoginBody).accessToken}`)
      .expect(401);
  });

  it('T-AUT-17: una contraseña de 12 caracteres sin símbolos es aceptada', async () => {
    const session = await login(fixtures.admin.email, fixtures.password).expect(
      200,
    );

    await request(server)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${(session.body as LoginBody).accessToken}`)
      .send({
        currentPassword: fixtures.password,
        newPassword: 'claveclave12',
      })
      .expect(204);

    await login(fixtures.admin.email, 'claveclave12').expect(200);
  });

  it('T-AUT-18: el reset del administrador obliga a cambiar la contraseña', async () => {
    const adminSession = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);

    const reset = await request(server)
      .post(`/api/v1/users/${fixtures.consulta.id}/reset-password`)
      .set(
        'Authorization',
        `Bearer ${(adminSession.body as LoginBody).accessToken}`,
      )
      .send({})
      .expect(200);
    const temporaryPassword = (reset.body as { temporaryPassword: string })
      .temporaryPassword;

    const userSession = await login(
      fixtures.consulta.email,
      temporaryPassword,
    ).expect(200);
    const userBody = userSession.body as LoginBody;
    expect(userBody.user.mustChangePassword).toBe(true);

    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${userBody.accessToken}`)
      .expect(200);

    const blocked = await request(server)
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${userBody.accessToken}`)
      .expect(403);
    expect((blocked.body as ErrorBody).error.code).toBe(
      'PASSWORD_CHANGE_REQUIRED',
    );

    const resetAudit = await prisma.auditLog.findMany({
      where: { action: 'USER_PASSWORD_RESET' },
    });
    expect(resetAudit).toHaveLength(1);
    expect(JSON.stringify(resetAudit)).not.toContain(temporaryPassword);
  });

  it('T-SEC-13: refresh rechaza un origen no confiable y exige cookie', async () => {
    await refresh(undefined).expect(401);

    const loginResponse = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);
    const cookie = extractRefreshCookie(setCookies(loginResponse));

    const blocked = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie ?? '')
      .set('Origin', 'https://sitio-malicioso.test')
      .expect(403);
    expect((blocked.body as ErrorBody).error.code).toBe('UNTRUSTED_ORIGIN');

    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie ?? '')
      .set('Origin', 'http://localhost:4200')
      .expect(200);
  });

  it('T-AUT-09: la contraseña almacenada usa bcrypt con coste 12', async () => {
    const adminSession = await login(
      fixtures.admin.email,
      fixtures.password,
    ).expect(200);

    await request(server)
      .post('/api/v1/users')
      .set(
        'Authorization',
        `Bearer ${(adminSession.body as LoginBody).accessToken}`,
      )
      .send({
        email: 'creado@test.local',
        fullName: 'Usuario Creado',
        password: 'ClaveTemporal#2026',
        roleCodes: ['CONSULTA'],
      })
      .expect(201);

    const created = await prisma.user.findUniqueOrThrow({
      where: { email: 'creado@test.local' },
    });
    expect(created.passwordHash).not.toBe('ClaveTemporal#2026');
    expect(created.passwordHash.startsWith('$2b$12$')).toBe(true);
    expect(getRounds(created.passwordHash)).toBe(12);
  });
});

describe('T-AUT-11: el contrato de sesión no depende del proveedor LOCAL', () => {
  let app: INestApplication;
  let server: Server;
  let fixtures: AuthFixtures;
  let fakeIdentity: AuthIdentity;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useValue({
        validateCredentials: jest.fn(() => Promise.resolve(fakeIdentity)),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    server = app.getHttpServer() as Server;
  });

  beforeEach(async () => {
    await resetDatabase();
    fixtures = await seedAuthFixtures();
    fakeIdentity = {
      userId: fixtures.admin.id,
      email: fixtures.admin.email,
      fullName: 'Identidad del doble',
      roles: ['ADMIN'],
      permissions: ['users.read'],
      mustChangePassword: false,
    };
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('un proveedor alternativo inicia sesión con el mismo contrato', async () => {
    const response = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: fixtures.admin.email, password: 'cualquier-cosa' })
      .expect(200);

    const body = response.body as LoginBody;
    expect(body.user.fullName).toBe('Identidad del doble');
    expect(body.user.permissions).toEqual(['users.read']);

    await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
  });
});

function hashOf(cookie: string | undefined): string {
  const value =
    (cookie ?? '').split(';')[0]?.replace('refresh_token=', '') ?? '';
  return createHash('sha256').update(value).digest('hex');
}
