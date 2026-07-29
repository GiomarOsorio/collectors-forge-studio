import { test, expect } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

async function mockInventory(page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (/\/inventory\/items\/?$/.test(pathname)) return json([]);
    if (/\/inventory\/spools\/?$/.test(pathname)) return json([]);
    if (/\/inventory\/spools\/low-stock$/.test(pathname)) return json([]);
    if (/\/purchase-orders\/?$/.test(pathname) || /\/purchases\/?$/.test(pathname)) return json([]);
    return route.fallback();
  });
}

test('toggle needs_purchase clickeando el texto', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsDev(page);
  await mockInventory(page);
  await page.goto('/inventory/bobinas');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: 'Agregar' }).first().click();

  const cb = page.getByRole('checkbox');
  await expect(cb.first()).not.toBeChecked();

  // click en el TEXTO (caso que estaba roto)
  await page.getByText('No, stock OK').click();
  await expect(cb.first()).toBeChecked();
  await expect(page.getByText('Sí — aparece en el listado de pendientes')).toBeVisible();

  // click en el TÍTULO no debe togglear (no es label del checkbox)
  await page.getByText('¿Marcar como necesario comprar?').click();
  await expect(cb.first()).toBeChecked();

  // click de nuevo en el texto lo apaga
  await page.getByText('Sí — aparece en el listado de pendientes').click();
  await expect(cb.first()).not.toBeChecked();
});
