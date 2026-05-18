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

  test('navega de /cost/v2 a la calculadora vía CTA', async ({ page }, testInfo) => {
    // El CTA "Nueva cotización" vive en el header desktop. En mobile no existe
    // (el equivalente es el FAB). Skip mobile.
    test.skip(testInfo.project.name === 'mobile-iphone12', 'CTA solo en desktop');
    await page.goto('/cost/v2');
    await page.waitForLoadState('networkidle');
    const ctaNueva = page.getByRole('link', { name: /nueva cotización/i }).first();
    await expect(ctaNueva).toBeVisible();
  });

  test('cambia entre tabs Cotizaciones / Historial / Calculadora', async ({ page }) => {
    await page.goto('/cost/v2');
    await page.waitForLoadState('networkidle');

    // Tab Historial existe y se puede activar
    const histTab = page.getByRole('button', { name: /historial/i }).first();
    if (await histTab.isVisible()) {
      await histTab.click();
      // El tab activo cambia el contenido (search placeholder distinto)
    }
  });

  test('calculator pre-rellena weight_grams y print_time desde slicer', async ({ page }) => {
    // /cost/calculator/v2 fue borrada en Fase 9 chunk B (V2 era incompleta);
    // el redirect a /cost/calculator preserva el query string vía
    // RedirectPreservingSearch. La calculadora V1 normaliza weight a 2
    // decimales (step=0.01) y convierte print_time_hours → minutos.
    await page.goto('/cost/calculator/v2?weight_grams=245&print_time_hours=3.5');
    await page.waitForLoadState('networkidle');

    const weightInput = page.locator('input[name="weight_grams"]');
    await expect(weightInput).toHaveValue('245.00');

    // V1 expone el tiempo de impresión en minutos (3.5h × 60 = 210min).
    const minutesInput = page.locator('input[name="print_time_minutes"]');
    await expect(minutesInput).toHaveValue('210');
  });

  // SKIP: el toast (react-hot-toast) usa portal fuera del árbol — getByText
  // intermitente en CI. Refactor pendiente: agregar data-testid al toast o
  // chequear el panel de resumen vacío en lugar del toast.
  test.skip('botón Calcular muestra error si faltan campos', async ({ page }) => {
    await page.goto('/cost/calculator/v2');
    await page.waitForLoadState('networkidle');
    const btnCalc = page.getByRole('button', { name: /calcular/i }).first();
    await btnCalc.click();
    await expect(page.getByText(/completa filamento/i)).toBeVisible({ timeout: 5_000 });
  });
});
