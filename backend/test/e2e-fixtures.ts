/**
 * Datos de prueba para los e2e de autenticación, RBAC y auditoría.
 * Se crean roles y permisos mínimos, equivalentes a la semilla real.
 */
import { hash } from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { prisma } from './integration/test-db';

export const TEST_PASSWORD = 'ClaveDePruebas#2026';
export const TEST_NEW_PASSWORD = 'OtraClaveLarga2026';

export const PERMISSIONS = [
  'users.read',
  'users.manage',
  'roles.manage',
  'audit.read',
  'movements.create',
  'extinguishers.read',
] as const;

const ROLE_MATRIX: Record<string, readonly string[]> = {
  ADMIN: PERMISSIONS,
  CONSULTA: ['extinguishers.read'],
  ALMACEN: ['extinguishers.read', 'movements.create'],
};

export interface AuthFixtures {
  password: string;
  admin: { id: string; email: string };
  consulta: { id: string; email: string };
  almacen: { id: string; email: string };
  inactive: { id: string; email: string };
}

async function createRole(code: string): Promise<string> {
  const id = randomUUID();
  await prisma.role.create({
    data: {
      id,
      code,
      name: code,
      isSystem: true,
    },
  });

  const permissionIds = await prisma.permission.findMany({
    where: { code: { in: [...ROLE_MATRIX[code]] } },
    select: { id: true },
  });
  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permission) => ({
        roleId: id,
        permissionId: permission.id,
      })),
    });
  }
  return id;
}

async function createUser(
  email: string,
  passwordHash: string,
  roleId: string,
  options: { active?: boolean; mustChangePassword?: boolean } = {},
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email,
      passwordHash,
      fullName: `Usuario ${email}`,
      active: options.active ?? true,
      mustChangePassword: options.mustChangePassword ?? false,
    },
  });
  await prisma.userRole.create({ data: { userId: id, roleId } });
  return { id, email };
}

export async function seedAuthFixtures(): Promise<AuthFixtures> {
  await prisma.permission.createMany({
    data: PERMISSIONS.map((code) => ({
      id: randomUUID(),
      code,
      description: `Permiso ${code}`,
    })),
  });

  const adminRole = await createRole('ADMIN');
  const consultaRole = await createRole('CONSULTA');
  const almacenRole = await createRole('ALMACEN');

  const passwordHash = await hash(TEST_PASSWORD, 12);

  const admin = await createUser('admin@test.local', passwordHash, adminRole);
  const consulta = await createUser(
    'consulta@test.local',
    passwordHash,
    consultaRole,
  );
  const almacen = await createUser(
    'almacen@test.local',
    passwordHash,
    almacenRole,
  );
  const inactive = await createUser(
    'inactivo@test.local',
    passwordHash,
    consultaRole,
    { active: false },
  );

  return {
    password: TEST_PASSWORD,
    admin,
    consulta,
    almacen,
    inactive,
  };
}

export interface LoginResponse {
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

export function extractRefreshCookie(
  setCookie: string[] | undefined,
): string | undefined {
  return setCookie?.find((cookie) => cookie.startsWith('refresh_token='));
}

export function refreshCookieValue(cookie: string): string {
  return cookie.split(';')[0] ?? '';
}
