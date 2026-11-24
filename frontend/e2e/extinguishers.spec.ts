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
    nominalCapacity: string;
    capacityUnit: 'KG' | 'L' | 'LB';
  }>;
}

interface LocationTreeResponse {
  data: Array<{
    id: string;
    type: string;
    code: string;
    name: string;
    children: Array<{
      id: string;
      type: string;
      code: string;
      name: string;
    }>;
  }>;
}

let assetCode = '';
let typeId = '';
let typeCapacity = '';
let typeCapacityUnit = '';
let warehouseId = '';
let warehouseLabel = '';
let createdExtinguisherId = '';
let createdAssetCode = '';

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

  typeId = type.id;
  typeCapacity = type.nominalCapacity;
  typeCapacityUnit = type.capacityUnit;
  warehouseId = warehouse!.id;
  warehouseLabel = `${warehouse!.name} (${warehouse!.code})`;

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
    page.getByRole('link', { name: `Abrir la ficha de ${assetCode}` }),
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

test('abre la ficha del extintor desde el listado', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/app/extintores?q=${assetCode}`);

  await page
    .getByRole('link', { name: `Abrir la ficha de ${assetCode}` })
    .click();

  await expect(page).toHaveURL(/\/app\/extintores\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole('heading', { name: assetCode, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText('Ubicación y estado')).toBeVisible();
  await expect(page.getByText('Trazabilidad')).toBeVisible();
  await expect(page.getByText(warehouseLabel)).toBeVisible();

  await expectNoA11yViolations(page);
});

test('registra un extintor desde la interfaz y muestra su ficha', async ({
  page,
}) => {
  await loginAsAdmin(page);
  await page.goto('/app/extintores/nuevo');

  await expect(
    page.getByRole('heading', { name: 'Nuevo extintor', level: 1 }),
  ).toBeVisible();

  await page.getByLabel('Tipo de extintor').selectOption(typeId);
  await expect(page.getByLabel('Capacidad', { exact: true })).toHaveValue(
    typeCapacity,
  );
  await expect(page.getByLabel('Unidad')).toHaveValue(typeCapacityUnit);

  await page.getByLabel('Número de serie').fill(`UI-${runId}`);
  await page.getByLabel('Marca').fill('Marca UI');
  await page.getByLabel('Ubicación inicial').selectOption(warehouseId);
  await page.getByLabel('Origen del ingreso').selectOption('COMPRA_LOCAL');
  await page.getByLabel('Condición inicial').selectOption('OPERATIVO');
  await page.getByLabel('Recibido por').fill('Recepción UI');
  await page.getByLabel('Referencia documental').fill(`ACTA-UI-${runId}`);
  await page
    .getByLabel('Motivo del ingreso')
    .fill('Alta de prueba E2E desde la interfaz');

  await page.getByRole('button', { name: 'Registrar extintor' }).click();

  await expect(page).toHaveURL(/\/app\/extintores\/[0-9a-f-]{36}/);
  const match = /\/app\/extintores\/([0-9a-f-]{36})/.exec(page.url());
  expect(match, 'la ficha debe exponer el identificador').not.toBeNull();
  createdExtinguisherId = match![1];

  await expect(
    page.getByText('Extintor registrado correctamente.'),
  ).toBeVisible();

  const heading = page.getByRole('heading', { level: 1 });
  createdAssetCode = (await heading.textContent())?.trim() ?? '';
  expect(createdAssetCode).toMatch(/^EXT-\d{6}$/);
  await expect(page.getByText('En almacén', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Operativo', { exact: true }).first()).toBeVisible();
});

test('edita los datos técnicos del extintor', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/app/extintores/${createdExtinguisherId}/editar`);

  await expect(
    page.getByRole('heading', { name: 'Editar extintor', level: 1 }),
  ).toBeVisible();

  const brand = `Marca UI ${runId}`;
  await page.getByLabel('Marca').fill(brand);
  await page.getByLabel('Modelo').fill('Modelo UI');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  await expect(
    page.getByText('Datos del extintor actualizados.'),
  ).toBeVisible();
  await expect(page.getByText(brand, { exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: createdAssetCode, level: 1 }),
  ).toBeVisible();
});

test('cambia la condición técnica con motivo auditado', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`/app/extintores/${createdExtinguisherId}/condicion`);

  await expect(
    page.getByRole('heading', {
      name: 'Cambiar condición técnica',
      level: 1,
    }),
  ).toBeVisible();

  await page.getByLabel('Nueva condición').selectOption('OBSERVADO');
  await page
    .getByLabel('Motivo del cambio')
    .fill('Observación detectada en la verificación E2E');
  await page.getByRole('button', { name: 'Cambiar condición' }).click();

  await expect(
    page.getByText('Condición técnica actualizada.'),
  ).toBeVisible();
  await expect(page.getByText('Observado', { exact: true }).first()).toBeVisible();
});

