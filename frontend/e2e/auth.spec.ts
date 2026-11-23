import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  changePassword,
  createUser,
  deactivateUser,
  ensureAdminSession,
  login,
  removeDashboardFromConsultaRole,
  restoreRolePermissions,
} from './support/api';

test.describe.configure({ mode: 'serial' });

const runId = Date.now().toString(36);
const CAMBIO_EMAIL = `cambio.${runId}@site.local`;
const CAMBIO_TEMP = 'Temporal#2026a';
const CAMBIO_FINAL = 'Definitiva#2026b';
const CONSULTA_EMAIL = `consulta.${runId}@site.local`;
const CONSULTA_TEMP = 'Temporal#2026c';
const CONSULTA_FINAL = 'Definitiva#2026d';

let adminToken = '';
let consultaRole: { roleId: string; originalPermissions: string[] } | null =
  null;
const createdUserIds: string[] = [];

async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();

  expect(
    results.violations,
    JSON.stringify(results.violations, null, 2),
  ).toEqual([]);
}

async function fillLogin(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
}

test.beforeAll(async ({ request }) => {
  const admin = await ensureAdminSession(request);
  adminToken = admin.accessToken;

  consultaRole = await removeDashboardFromConsultaRole(request, adminToken);

  const consulta = await createUser(request, adminToken, {
    email: CONSULTA_EMAIL,
    fullName: 'Consulta E2E',
    password: CONSULTA_TEMP,
    roleCodes: ['CONSULTA'],
  });
  createdUserIds.push(consulta.id);

  const consultaSession = await login(request, CONSULTA_EMAIL, CONSULTA_TEMP);
  expect(consultaSession.user.mustChangePassword).toBe(true);
  await changePassword(
    request,
    consultaSession.accessToken,
    CONSULTA_TEMP,
    CONSULTA_FINAL,
  );

  const cambio = await createUser(request, adminToken, {
    email: CAMBIO_EMAIL,
    fullName: 'Cambio E2E',
    password: CAMBIO_TEMP,
    roleCodes: ['ALMACEN'],
  });
  createdUserIds.push(cambio.id);
});

test.afterAll(async ({ request }) => {
  try {
    if (consultaRole !== null) {
      await restoreRolePermissions(
        request,
        adminToken,
        consultaRole.roleId,
        consultaRole.originalPermissions,
      );
    }
    for (const userId of createdUserIds) {
      await deactivateUser(request, adminToken, userId);
    }
  } catch (error) {
    console.warn('No se pudo limpiar la base de E2E:', error);
  }
});

test('protege las rutas y traduce las credenciales inválidas', async ({
  page,
}) => {
  await page.goto('/app/inicio');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2Fapp%2Finicio/);

  await expectNoA11yViolations(page);

  await fillLogin(page, ADMIN_EMAIL, 'clave-incorrecta-1');

  await expect(page.getByRole('alert')).toContainText(
    'El correo o la contraseña no son correctos.',
  );
  await expect(page).toHaveURL(/\/login\?returnUrl=/);
});

test('obliga a cambiar la contraseña, renueva la sesión y cierra sesión', async ({
  page,
}) => {
  await page.goto('/login');
  await fillLogin(page, CAMBIO_EMAIL, CAMBIO_TEMP);

  await expect(page).toHaveURL(/\/app\/cambiar-contrasena/);
  await expect(
    page.getByText('Debes cambiar la contraseña para continuar.'),
  ).toBeVisible();

  await page.getByLabel('Contraseña actual').fill(CAMBIO_TEMP);
  await page
    .getByLabel('Nueva contraseña', { exact: true })
    .fill(CAMBIO_FINAL);
  await page.getByLabel('Repite la nueva contraseña').fill(CAMBIO_FINAL);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();

  await expect(page.getByText('Contraseña actualizada.')).toBeVisible();
  await page.getByRole('link', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/app\/inicio/);
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a SITE' }),
  ).toBeVisible();

  const storage = await page.evaluate(() => ({
    local: localStorage.length,
    session: sessionStorage.length,
    content: JSON.stringify({ ...localStorage }),
  }));
  expect(storage.local).toBe(0);
  expect(storage.session).toBe(0);
  expect(storage.content).not.toContain('eyJ');

  await page.reload();
  await expect(page).toHaveURL(/\/app\/inicio/);
  await expect(
    page.getByRole('heading', { name: 'Bienvenido a SITE' }),
  ).toBeVisible();
  await expect(page.locator('#main-content')).toBeFocused();

  const skipLink = page.getByRole('link', {
    name: 'Ir al contenido principal',
  });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar sesión' }).click();

  await expect(page).toHaveURL(/\/login/);
  await page.reload();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel('Correo electrónico')).toBeVisible();
});

test('muestra sin permiso y oculta el menú sin permiso', async ({ page }) => {
  await page.goto('/login');
  await fillLogin(page, CONSULTA_EMAIL, CONSULTA_FINAL);

  await expect(page).toHaveURL(/\/app\/sin-permiso/);
  await expect(page.getByRole('heading', { name: 'Sin permiso' })).toBeVisible();

  const navigation = page.getByRole('navigation', {
    name: 'Navegación principal',
  });
  await expect(
    navigation.getByRole('link', { name: 'Inicio' }),
  ).toHaveCount(0);
  await expect(
    navigation.getByRole('link', { name: 'Inventario' }),
  ).toHaveCount(1);

  await navigation.getByRole('link', { name: 'Inventario' }).click();
  await expect(page).toHaveURL(/\/app\/extintores/);
  await expect(
    page.getByRole('heading', { name: 'Inventario de extintores' }),
  ).toBeVisible();

  await expectNoA11yViolations(page);
});

test('es usable a 360 px, con teclado y sin violaciones WCAG AA', async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/login');
  await fillLogin(page, ADMIN_EMAIL, ADMIN_PASSWORD);

  await expect(
    page.getByRole('heading', { name: 'Bienvenido a SITE' }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const menuButton = page.getByRole('button', { name: 'Abrir menú' });
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  const navigation = page.getByRole('navigation', {
    name: 'Navegación principal',
  });
  const homeLink = navigation.getByRole('link', { name: 'Inicio' });
  await expect(homeLink).toBeVisible();
  await homeLink.click();
  await expect(homeLink).toBeHidden();

  await expectNoA11yViolations(page);

  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Cerrar sesión' })
    .click();
  await expect(page).toHaveURL(/\/login/);

  await page.locator('main.auth-card').click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Tab');
  const email = page.locator('#email');
  await expect(email).toBeFocused();
  const outline = await email.evaluate(
    (element) => getComputedStyle(element).outlineStyle,
  );
  expect(outline).not.toBe('none');
});
