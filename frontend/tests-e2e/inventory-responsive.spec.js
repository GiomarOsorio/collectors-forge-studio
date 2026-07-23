/**
 * @file Screenshot-tests responsive de Inventario (issue #165).
 *
 *  - /inventory = Resumen (overview) tras la consolidación de nav (PR A).
 *  - FilamentTable (vista tabla, /inventory/bobinas): wrapper overflow-x-auto +
 *    min-width, para que en 1024-1279 haga scroll-x en vez de comprimir
 *    columnas (Fix #15).
 *
 * Contenido MOCKEADO (determinista) para que el baseline no dependa del seed
 * ni del entorno del runner — mismo patrón que queue-responsive / projects-
 * history. Valida cero overflow-x del documento en cada breakpoint.
 *
 * @module tests-e2e/inventory-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FILAMENTS = [
  {
    id: 1, category: 'Filamento', name: 'Spool A-2411', color_name: 'Midnight',
    color_hex: '#1B2437', filament_type: 'PETG', filament_subtype: '', quantity: 0,
    weight_per_roll: 1000, price_per_kg: 18.99, sale_price: 40, supplier_name: 'SUNLU',
    batch: 'B-2411', location: 'Stand · B5', min_quantity: 200, notes: '',
  },
  {
    id: 2, category: 'Filamento', name: 'Spool B-2420', color_name: 'Rojo',
    color_hex: '#D42B2B', filament_type: 'PETG', filament_subtype: '', quantity: 500,
    weight_per_roll: 1000, price_per_kg: 18.99, sale_price: 40, supplier_name: 'SUNLU',
    batch: 'B-2420', location: 'Stand · A4', min_quantity: 200, notes: '',
  },
  {
    id: 3, category: 'Filamento', name: 'Spool C-2388', color_name: 'Pino Blanco',
    color_hex: '#C9B7A2', filament_type: 'PLA', filament_subtype: '', quantity: 1000,
    weight_per_roll: 1000, price_per_kg: 30, sale_price: 55, supplier_name: 'Creality',
    batch: 'B-2388', location: 'Stand · C2', min_quantity: 200, notes: '',
  },
];

const SPOOLS = [
  { id: 10, inventory_item_id: 1, status: 'active', remaining_weight_g: 600, initial_weight_g: 1000, percent_remaining: 60 },
  { id: 11, inventory_item_id: 1, status: 'active', remaining_weight_g: 100, initial_weight_g: 1000, percent_remaining: 10 },
];

async function mockInventory(page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (/\/inventory\/items\/?$/.test(pathname)) return json(FILAMENTS);
    if (/\/inventory\/spools\/?$/.test(pathname)) return json(SPOOLS);
    if (/\/inventory\/spools\/low-stock$/.test(pathname)) return json([]);
    if (/\/purchase-orders\/?$/.test(pathname) || /\/purchases\/?$/.test(pathname)) return json([]);
    return route.fallback();
  });
}

test.describe('Inventory responsive — issue #165', () => {
  test('inventario a 390px: sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await mockInventory(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page).toHaveScreenshot('inventory-390.png', { fullPage: true });
  });

  test('inventario a 1280px: sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsDev(page);
    await mockInventory(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);

    await expect(page).toHaveScreenshot('inventory-1280.png', { fullPage: true });
  });

  test('punto ciego 1100px + vista tabla de filamentos: sin overflow-x del documento', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 850 });
    await loginAsDev(page);
    await mockInventory(page);
    await page.goto('/inventory/bobinas');
    await page.waitForLoadState('networkidle');

    // Cambia a la vista tabla (FilamentTable, Fix #15).
    const tableToggle = page.getByRole('button', { name: 'Vista tabla' });
    if (await tableToggle.count()) {
      await tableToggle.first().click();
      await page.waitForTimeout(200);
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1100);

    await expect(page).toHaveScreenshot('inventory-table-1100.png', { fullPage: true });
  });
});
