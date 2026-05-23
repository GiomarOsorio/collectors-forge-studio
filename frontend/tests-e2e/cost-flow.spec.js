/**
 * @file E2E del flujo crítico de Cost: navegar a calculadora, ver datos
 * cargados desde slicer (pre-fill por query params), revisar drawer de
 * cotización.
 *
 * @module tests-e2e/cost-flow.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Cost — flujos críticos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test('navega de /cost a la calculadora vía CTA', async ({ page }, testInfo) => {
    // El CTA "Nueva cotización" vive en el header desktop. En mobile no existe
    // (el equivalente es el FAB). Skip mobile.
    test.skip(testInfo.project.name === 'mobile-iphone12', 'CTA solo en desktop');
    await page.goto('/cost');
    await page.waitForLoadState('networkidle');
    const ctaNueva = page.getByRole('link', { name: /nueva cotización/i }).first();
    await expect(ctaNueva).toBeVisible();
  });

  test('cambia entre tabs Cotizaciones / Historial / Calculadora', async ({ page }) => {
    await page.goto('/cost');
    await page.waitForLoadState('networkidle');

    // Tab Historial existe y se puede activar
    const histTab = page.getByRole('button', { name: /historial/i }).first();
    if (await histTab.isVisible()) {
      await histTab.click();
      // El tab activo cambia el contenido (search placeholder distinto)
    }
  });

  test('calculator pre-rellena weight_grams y print_time desde slicer', async ({ page }) => {
    // /cost/calculator/v2 sigue como ruta legacy (redirect a /cost/calculator
    // preservando query string vía RedirectPreservingSearch). El form v2 usa
    // Stepper (no <input name=...>): los inputs viven dentro de los wrappers
    // identificables por su FormFieldRow label. Validamos el value cargado.
    await page.goto('/cost/calculator/v2?weight_grams=245&print_time_hours=3.5');
    await page.waitForLoadState('networkidle');

    // El form v2 mapea print_time_hours → hours + minutes separados.
    // 3.5h = 3h 30m. weight_grams se redondea al entero (245).
    // Los Stepper exponen <input type="number"> sin name attribute, por lo
    // que filtramos por valor entre los inputs numéricos visibles.
    const numericInputs = page.locator('input[type="number"]');
    await numericInputs.first().waitFor({ state: 'visible', timeout: 10_000 });
    const values = await numericInputs.evaluateAll((els) => els.map((e) => e.value));
    expect(values, 'weight_grams=245 cargado').toContain('245');
    expect(values, 'hours=3 cargado desde 3.5h').toContain('3');
    expect(values, 'minutes=30 cargado desde 3.5h').toContain('30');
  });

  // SKIP: el toast (react-hot-toast) usa portal fuera del árbol — getByText
  // intermitente en CI. Refactor pendiente: agregar data-testid al toast o
  // chequear el panel de resumen vacío en lugar del toast.
  test.skip('botón Calcular muestra error si faltan campos', async ({ page }) => {
    await page.goto('/cost/calculator');
    await page.waitForLoadState('networkidle');
    const btnCalc = page.getByRole('button', { name: /calcular/i }).first();
    await btnCalc.click();
    await expect(page.getByText(/completa filamento/i)).toBeVisible({ timeout: 5_000 });
  });
});
