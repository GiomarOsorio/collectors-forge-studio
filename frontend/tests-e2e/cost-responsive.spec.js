/**
 * @file Screenshot-tests responsive de Cost (issue #162).
 *
 * Cubre los dos rotos que motivaron el issue:
 *  - ManualQuotePage a 390px: antes usaba el mismo grid de px fijos en
 *    mobile y desktop (`ItemRow`) → headers de columna encimados, tabla
 *    cortada sin scroll. Ahora usa `<LineItems>` (P1): cards apiladas.
 *  - CalculatorPage en el punto ciego 1024-1279 (sidebar 256px + grid
 *    mínimo 1060px = overflow garantizado): ahora colapsa a 2 columnas
 *    en `lg`, 3 columnas solo desde `xl` (≥1280).
 *
 * No son solo screenshots — cada test también valida cero overflow-x
 * (`scrollWidth <= viewport`), que es la regresión real que importa.
 *
 * @module tests-e2e/cost-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Cost responsive — issue #162', () => {
  test('ManualQuotePage a 390px: sin overflow-x, ítem visible como card', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await page.goto('/cost/manual');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page.getByPlaceholder('Nombre del producto').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible();

    await expect(page).toHaveScreenshot('manual-390.png', { fullPage: true });
  });

  test('ManualQuotePage a 390px: botón Guardar no queda tapado por el bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await page.goto('/cost/manual');
    await page.waitForLoadState('networkidle');

    const guardar = page.getByRole('button', { name: 'Guardar' });
    const bottomNav = page.locator('nav[aria-label="Navegación principal"]');
    const guardarBox = await guardar.boundingBox();
    const navBox = await bottomNav.boundingBox();
    expect(guardarBox.y + guardarBox.height).toBeLessThanOrEqual(navBox.y + 1);
  });

  test('CalculatorPage en el punto ciego (1100px): sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 850 });
    await loginAsDev(page);
    await page.goto('/cost/calculator');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1100);

    await expect(page).toHaveScreenshot('calculator-1100.png', { fullPage: true });
  });

  test('CalculatorPage a 1280px (xl): 3 columnas, sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsDev(page);
    await page.goto('/cost/calculator');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);

    await expect(page).toHaveScreenshot('calculator-1280.png', { fullPage: true });
  });

  test('CostPage → tab Calculadora embebida: sin overflow-x en 1100 y 1280', async ({ page }) => {
    await loginAsDev(page);
    for (const width of [1100, 1280]) {
      await page.setViewportSize({ width, height: 850 });
      await page.goto('/cost');
      await page.waitForLoadState('networkidle');
      await page.getByRole('tab', { name: /Calculadora/ }).click();
      await page.waitForTimeout(300);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(width);
    }
  });
});
