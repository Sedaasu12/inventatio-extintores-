/**
 * Resolución de la base de datos usada por las pruebas.
 *
 * Prioridad:
 * 1. `TEST_DATABASE_URL` explícita.
 * 2. `DATABASE_URL` del entorno: se deriva el mismo servidor y se cambia el
 *    nombre de la base por `<nombre>_test` (por ejemplo, `site` → `site_test`).
 * 3. Valor local por defecto (MySQL de desarrollo publicado en 3307).
 *
 * El administrador también se deriva del servidor de pruebas para que CI y
 * desarrollo compartan el mismo código: mismas credenciales de la aplicación,
 * usuario `root` para crear la base dedicada.
 */
const LOCAL_TEST_DATABASE_URL = 'mysql://site:site@localhost:3307/site_test';

export function resolveTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }

  const base = process.env.DATABASE_URL?.trim();
  if (base && base.length > 0) {
    const url = new URL(base);
    const name = url.pathname.replace(/^\//, '');
    if (name.length > 0 && !name.endsWith('_test')) {
      url.pathname = `/${name}_test`;
    }
    return url.toString();
  }

  return LOCAL_TEST_DATABASE_URL;
}

export function resolveTestAdminDatabaseUrl(
  testDatabaseUrl: string = resolveTestDatabaseUrl(),
): string {
  const explicit = process.env.TEST_DATABASE_ADMIN_URL?.trim();
  if (explicit && explicit.length > 0) {
    return explicit;
  }

  const url = new URL(testDatabaseUrl);
  url.username = 'root';
  url.password = 'root';
  url.pathname = '/';
  return url.toString();
}
