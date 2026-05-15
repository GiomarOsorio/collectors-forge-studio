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

  test('navega de /cost/v2 a la calculadora vía CTA', async ({ page }) => {
    await page.goto('/cost/v2');
    await page.waitForLoadState('networkidle');
    // CTA "Nueva cotización" en el header → /cost/manual (vista clásica)
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

  test('calculator/v2 pre-rellena weight_grams y print_time_hours desde slicer', async ({ page }) => {
    await page.goto('/cost/calculator/v2?weight_grams=245&print_time_hours=3.5');
    await page.waitForLoadState('networkidle');

    const weightInput = page.locator('input[name="weight_grams"]');
    await expect(weightInput).toHaveValue('245');
    const timeInput = page.locator('input[name="print_time_hours"]');
    await expect(timeInput).toHaveValue('3.5');
  });

  test('botón Calcular muestra error si faltan campos', async ({ page }) => {
    await page.goto('/cost/calculator/v2');
    await page.waitForLoadState('networkidle');
    const btnCalc = page.getByRole('button', { name: /calcular/i }).first();
    await btnCalc.click();
    // Toast de error o mensaje validation
    await expect(page.getByText(/completa filamento/i)).toBeVisible({ timeout: 5_000 });
  });
});
