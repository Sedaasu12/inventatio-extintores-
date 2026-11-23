import { defineConfig, devices } from '@playwright/test';

const frontendUrl = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:4200';
const backendUrl = process.env['E2E_BACKEND_URL'] ?? 'http://localhost:3000';

/**
 * Las pruebas E2E necesitan una base **desechable** ya migrada y sembrada:
 * el flujo cambia la contraseña del administrador y los permisos del rol
 * CONSULTA para verificar el 403. El README explica cómo prepararla.
 */
function environment(overrides: Record<string, string>): Record<string, string> {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  return { ...inherited, ...overrides };
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: process.env['CI'] !== undefined,
  reporter: process.env['CI'] !== undefined
    ? [['list'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: frontendUrl,
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node dist/src/main.js',
      cwd: '../backend',
      url: `${backendUrl}/api/v1/health`,
      reuseExistingServer: process.env['CI'] === undefined,
      timeout: 120_000,
      env: environment({
        NODE_ENV: 'test',
        PORT: '3000',
        TZ: 'America/Lima',
        DATABASE_URL:
          process.env['E2E_DATABASE_URL'] ??
          'mysql://site:site@localhost:3307/site_e2e',
        COOKIE_SECURE: 'false',
        CORS_ORIGINS: frontendUrl,
        RATE_LIMIT_LOGIN: '200',
      }),
    },
    {
      command: 'npm start -- --host 127.0.0.1 --port 4200',
      url: frontendUrl,
      reuseExistingServer: process.env['CI'] === undefined,
      timeout: 180_000,
    },
  ],
});
