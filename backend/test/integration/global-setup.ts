/**
 * Preparación de la base de datos de integración.
 *
 * - Crea `site_test` si no existe y otorga permisos al usuario de la aplicación.
 * - Aplica todas las migraciones versionadas con `prisma migrate deploy`.
 *
 * Nunca usa la base de desarrollo: si `TEST_DATABASE_URL` apunta a `site`,
 * la ejecución se aborta antes de tocar nada.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const DEFAULT_TEST_DATABASE_URL = 'mysql://site:site@localhost:3307/site_test';
const DEFAULT_ADMIN_DATABASE_URL = 'mysql://root:root@localhost:3307/';

function testDatabaseUrl(): string {
  const fromEnv = process.env.TEST_DATABASE_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_TEST_DATABASE_URL;
}

function adminDatabaseUrl(): string {
  const fromEnv = process.env.TEST_DATABASE_ADMIN_URL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_ADMIN_DATABASE_URL;
}

function serverUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = '/';
  return url.toString();
}

function databaseName(databaseUrl: string): string {
  const name = new URL(databaseUrl).pathname.replace(/^\//, '');
  if (!/^[A-Za-z0-9_]+$/.test(name)) {
    throw new Error(
      `Nombre de base de datos de pruebas inválido: "${name}". Usa solo letras, números y guion bajo.`,
    );
  }
  return name;
}

function executeSql(url: string, sql: string): void {
  execFileSync('npx', ['prisma', 'db', 'execute', '--url', url, '--stdin'], {
    cwd: resolve(__dirname, '..', '..'),
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
}

export default function globalSetup(): void {
  const url = testDatabaseUrl();
  const name = databaseName(url);

  if (name === 'site') {
    throw new Error(
      'TEST_DATABASE_URL apunta a la base de desarrollo "site". Usa una base dedicada (por ejemplo, site_test).',
    );
  }

  const parsed = new URL(url);
  const dbUser = decodeURIComponent(parsed.username);

  executeSql(
    serverUrl(adminDatabaseUrl()),
    [
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`,
      `GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${dbUser}'@'%';`,
      'FLUSH PRIVILEGES;',
    ].join('\n'),
  );

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..', '..'),
    env: {
      ...process.env,
      DATABASE_URL: url,
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
    stdio: 'pipe',
    shell: process.platform === 'win32',
  });
}
