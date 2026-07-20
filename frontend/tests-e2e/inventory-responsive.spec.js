/**
 * @file Screenshot-tests responsive de Inventario (issue #165).
 *
 *  - CategoryTabs → AppTabs (overflow-x + fade), KPIStrip P5 con fade.
 *  - FilamentTable (vista tabla): wrapper overflow-x-auto + min-width, para
 *    que en 1024-1279 haga scroll-x en vez de comprimir columnas (Fix #15).
 *  - NewPOForm / PO form drawer: líneas como LineItems (P1) — cards mobile,
 *    grid minmax(0,fr) desktop (Fix #5).
 *
 * Se apoya en el seed de dev (como los tests de galería del Vault); valida
 * cero overflow-x del documento en cada breakpoint.
 *
 * @module tests-e2e/inventory-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Inventory responsive — issue #165', () => {
  test('inventario a 390px: sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page).toHaveScreenshot('inventory-390.png', { fullPage: true });
  });

  test('inventario a 1280px: sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsDev(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);

    await expect(page).toHaveScreenshot('inventory-1280.png', { fullPage: true });
  });

  test('punto ciego 1100px + vista tabla de filamentos: sin overflow-x del documento', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 850 });
    await loginAsDev(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Cambia a la vista tabla (FilamentTable, Fix #15). El botón vive en el
    // toggle grid/tabla del toolbar.
    const tableToggle = page.getByRole('button', { name: 'Vista tabla' });
    if (await tableToggle.count()) {
      await tableToggle.first().click();
      await page.waitForTimeout(200);
    }

    // La tabla puede scrollear-x DENTRO de su wrapper; lo que no debe pasar es
    // que el documento entero desborde en el punto ciego 1024-1279.
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1100);

    await expect(page).toHaveScreenshot('inventory-table-1100.png', { fullPage: true });
  });
});
