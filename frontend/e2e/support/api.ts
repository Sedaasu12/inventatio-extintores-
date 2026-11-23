import type { APIRequestContext } from '@playwright/test';
import { expect } from '@playwright/test';

export const API_URL =
  process.env['E2E_API_URL'] ?? 'http://localhost:3000/api/v1';

export const ADMIN_EMAIL = 'admin@site.local';

/** Contraseña con la que se siembra el administrador en la base de E2E. */
export const SEED_ADMIN_PASSWORD =
  process.env['E2E_SEED_ADMIN_PASSWORD'] ?? 'E2eAdmin#2026seed';

/** Contraseña definitiva que aplican las pruebas al administrador. */
export const ADMIN_PASSWORD =
  process.env['E2E_ADMIN_PASSWORD'] ?? 'E2eAdmin#2026final';

export interface SessionUser {
  id: string;
  email: string;
  permissions: string[];
  mustChangePassword: boolean;
}

export interface Session {
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}

export function bearer(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export async function login(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Session> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(response.status(), `login de ${email}`).toBe(200);
  return (await response.json()) as Session;
}

async function tryLogin(
  request: APIRequestContext,
  email: string,
  password: string,
): Promise<Session | null> {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  if (response.status() === 401) {
    return null;
  }
  expect(response.status(), `login de ${email}`).toBe(200);
  return (await response.json()) as Session;
}

/**
 * Devuelve una sesión de administrador sin contraseña pendiente. Si la base
 * ya fue usada por una ejecución anterior, reutiliza la contraseña definitiva.
 */
export async function ensureAdminSession(
  request: APIRequestContext,
): Promise<Session> {
  const current = await tryLogin(request, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (current !== null) {
    return current;
  }

  const seeded = await tryLogin(request, ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
  if (seeded === null) {
    throw new Error(
      'No se pudo iniciar sesión como administrador. Revisa E2E_SEED_ADMIN_PASSWORD o vuelve a sembrar la base de E2E.',
    );
  }

  await changePassword(
    request,
    seeded.accessToken,
    SEED_ADMIN_PASSWORD,
    ADMIN_PASSWORD,
  );
  return login(request, ADMIN_EMAIL, ADMIN_PASSWORD);
}

export async function changePassword(
  request: APIRequestContext,
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const response = await request.post(`${API_URL}/auth/change-password`, {
    headers: bearer(token),
    data: { currentPassword, newPassword },
  });
  expect(response.status(), 'cambio de contraseña').toBe(204);
}

export interface Role {
  id: string;
  code: string;
  permissions: string[];
}

/** Quita `dashboard.read` al rol CONSULTA para probar el 403 de la interfaz. */
export async function removeDashboardFromConsultaRole(
  request: APIRequestContext,
  token: string,
): Promise<{ roleId: string; originalPermissions: string[] }> {
  const response = await request.get(`${API_URL}/roles`, {
    headers: bearer(token),
  });
  expect(response.status()).toBe(200);
  const roles = (await response.json()) as Role[];
  const role = roles.find((candidate) => candidate.code === 'CONSULTA');
  if (role === undefined) {
    throw new Error('El rol CONSULTA no existe en la base de E2E.');
  }

  const updated = await request.put(
    `${API_URL}/roles/${role.id}/permissions`,
    {
      headers: bearer(token),
      data: { permissionCodes: ['extinguishers.read'] },
    },
  );
  expect(updated.status()).toBe(200);

  return { roleId: role.id, originalPermissions: role.permissions };
}

export async function restoreRolePermissions(
  request: APIRequestContext,
  token: string,
  roleId: string,
  permissionCodes: string[],
): Promise<void> {
  const response = await request.put(
    `${API_URL}/roles/${roleId}/permissions`,
    { headers: bearer(token), data: { permissionCodes } },
  );
  expect(response.status()).toBe(200);
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  roleCodes: string[];
}

export async function createUser(
  request: APIRequestContext,
  token: string,
  input: CreateUserInput,
): Promise<{ id: string }> {
  const response = await request.post(`${API_URL}/users`, {
    headers: bearer(token),
    data: input,
  });
  expect(response.status(), `alta de ${input.email}`).toBe(201);
  const body = (await response.json()) as { user: { id: string } };
  return body.user;
}

export async function deactivateUser(
  request: APIRequestContext,
  token: string,
  userId: string,
): Promise<void> {
  const response = await request.post(`${API_URL}/users/${userId}/deactivate`, {
    headers: bearer(token),
  });
  expect(response.status()).toBe(204);
}
