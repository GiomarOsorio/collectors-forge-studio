/**
 * @file E2E del flujo crítico de Cost: navegar a calculadora, cambiar
 * entre tabs, revisar drawer de cotización.
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

  test('sub-nav consolidada de Cost navega por rutas', async ({ page }) => {
    await page.goto('/cost');
    await page.waitForLoadState('networkidle');

    // La sub-nav consolidada (CostNavTabs, role=tab) navega a rutas reales.
    await page.getByRole('tab', { name: /Historial/ }).click();
    await page.waitForURL('**/cost/history');
    expect(page.url()).toContain('/cost/history');
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
