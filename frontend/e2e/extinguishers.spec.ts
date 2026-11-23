import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  API_URL,
  bearer,
  ensureAdminSession,
} from './support/api';

test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString(36);
const serialNumber = `E2E-${runId}`;

interface TypeListResponse {
  data: Array<{
    id: string;
    code: string;
    capacityUnit: 'KG' | 'L' | 'LB';
  }>;
}

interface LocationTreeResponse {
  data: Array<{
    id: string;
    type: string;
    children: Array<{ id: string; type: string }>;
  }>;
}

let assetCode = '';

async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill(ADMIN_EMAIL);
  await page.getByLabel('Contraseña', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(/\/app\/inicio/);
}

test.beforeAll(async ({ request }) => {
  const admin = await ensureAdminSession(request);

  const typesResponse = await request.get(`${API_URL}/extinguisher-types`, {
    headers: bearer(admin.accessToken),
    params: { active: 'true', pageSize: 100 },
  });
  expect(typesResponse.status()).toBe(200);
  const types = (await typesResponse.json()) as TypeListResponse;
  const type = types.data[0];

  const locationsResponse = await request.get(`${API_URL}/locations`, {
    headers: bearer(admin.accessToken),
    params: { tree: 'true', active: 'true' },
  });
  expect(locationsResponse.status()).toBe(200);
  const locations = (await locationsResponse.json()) as LocationTreeResponse;
  const warehouse = locations.data
    .flatMap((sede) => sede.children)
    .find((location) => location.type === 'ALMACEN');

  expect(type, 'debe existir al menos un tipo de extintor').toBeDefined();
  expect(warehouse, 'debe existir al menos un almacén').toBeDefined();

  const created = await request.post(`${API_URL}/extinguishers`, {
    headers: {
      ...bearer(admin.accessToken),
      'Idempotency-Key': `e2e-inventory-${runId}`,
    },
    data: {
      serialNumber,
      typeId: type.id,
      brand: 'Marca E2E',
      model: 'Modelo E2E',
      capacityValue: 6,
      capacityUnit: type.capacityUnit,
      initialLocationId: warehouse!.id,
      entrySource: 'COMPRA_LOCAL',
      initialReason: 'Alta de prueba E2E para el listado de inventario',
      receivedBy: 'Recepción E2E',
      documentRef: `ACTA-E2E-${runId}`,
      technicalCondition: 'OPERATIVO',
    },
  });
  expect(created.status(), await created.text()).toBe(201);
  const body = (await created.json()) as { assetCode: string };
  assetCode = body.assetCode;
});

test('lista, filtra y limpia el inventario con paginación del servidor', async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/app/extintores');

  await expect(
    page.getByRole('heading', { name: 'Inventario de extintores' }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByLabel('Buscar').fill(assetCode);
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(page).toHaveURL(new RegExp(`q=${assetCode}`));
  await expect(
    page.getByRole('cell', { name: assetCode, exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Mostrando 1 de 1 extintores.')).toBeVisible();

  const table = page.getByRole('table');
  await expect(table.getByText('En almacén', { exact: true })).toBeVisible();
  await expect(table.getByText('Operativo', { exact: true })).toBeVisible();

  await page.getByLabel('Estado logístico').selectOption('ASIGNADO');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();

  await expect(
    page.getByText('No hay extintores que coincidan con los filtros'),
  ).toBeVisible();

  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(
    page.getByRole('heading', { name: 'Inventario de extintores' }),
  ).toBeVisible();
});
