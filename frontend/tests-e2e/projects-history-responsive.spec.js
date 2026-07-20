/**
 * @file E2E responsive de Projects + History (issue #167).
 *
 * - Projects: ProjectFormModal ahora es P6 dual — MobileSheet <1024 /
 *   DetailDrawer ≥1024 (antes modal centrado). Se abre con el FAB «Nuevo»
 *   (mobile) o el botón «Nuevo proyecto» (desktop).
 * - History (/cost/history): shell dual + tabla → ResponsiveTable (cards en
 *   mobile) + detalle/edición P6.
 *
 * @module tests-e2e/projects-history-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

function quote(id, over = {}) {
  return {
    id,
    piece_name: `Pieza ${id}`,
    client_name: 'Daniela Vergara',
    description: null,
    quantity: 2,
    created_at: '2026-07-14T10:00:00',
    material_cost: 10, electricity_cost: 2, depreciation_cost: 3,
    labor_cost: 5, failure_cost: 1, subtotal: 21,
    margin_percent: 30, margin_amount: 6.3,
    total_price: 27.3, total_per_unit: 13.65,
    total_price_cop: 90000, total_per_unit_cop: 45000,
    usd_to_cop_rate: 4000,
    ...over,
  };
}

test.describe('Projects responsive — ProjectFormModal P6 (issue #167)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/projects\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      if (/\/api\/client-quotes\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      return route.fallback();
    });
  });

  test('desktop 1280px: «Nuevo proyecto» abre DetailDrawer lateral', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /nuevo proyecto/i }).first().click();
    await expect(page.getByPlaceholder(/Encargo boda/).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/projects-form-desktop-1280.png' });
  });

  test('mobile 390px: FAB «Nuevo» abre MobileSheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /nuevo proyecto/i }).last().click();
    await expect(page.getByPlaceholder(/Encargo boda/).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/projects-form-mobile-390.png' });
  });
});

test.describe('History responsive — ResponsiveTable + P6 (issue #167)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/quotes\/?$/.test(pathname)) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify([quote(1), quote(2, { piece_name: 'Pieza 2', total_price_cop: null, total_price: 12.5 })]),
        });
      }
      return route.fallback();
    });
  });

  test('desktop 1280px: tabla de costos', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/cost/history');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Historial de costos de impresión')).toBeVisible();
    await expect(page.getByText('Pieza 1')).toBeVisible();
    await page.screenshot({ path: 'test-results/history-desktop-1280.png' });
  });

  test('mobile 390px: cards + detalle en MobileSheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cost/history');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Pieza 1')).toBeVisible();
    await page.screenshot({ path: 'test-results/history-mobile-390.png' });

    await page.getByRole('button', { name: /ver/i }).first().click();
    await expect(page.getByText('Total cotización (USD)')).toBeVisible();
    await page.screenshot({ path: 'test-results/history-detail-mobile-390.png' });
  });
});
