/**
 * @file E2E básico de Stats (issue #132) — carga con datos, empty state.
 *
 * @module tests-e2e/stats.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FAKE_OVERVIEW = {
  prints_done: 3,
  prints_cancelled: 1,
  success_rate_pct: 75,
  total_hours: 9,
  grams_by_filament_type: [
    { filament_type: 'PLA', grams: 250, cost_cop: 5000 },
    { filament_type: 'PETG', grams: 200, cost_cop: 6000 },
  ],
  by_printer: [{ printer_id: 1, printer_name: 'P2S del estudio', prints: 2, hours: 7 }],
  by_user: [{ user_id: 1, username: 'giomar', prints: 3 }],
  failure_breakdown: [{ category: 'warping', count: 1 }],
  material_cost_cop: 11000,
  electricity_cost_cop: 2000,
};

const FAKE_TRENDS = {
  bucket: 'day',
  series: [
    { bucket_start: '2026-01-15', prints_done: 2, prints_cancelled: 0, grams: 150 },
    { bucket_start: '2026-01-16', prints_done: 1, prints_cancelled: 1, grams: 200 },
  ],
};

test.describe('Stats (issue #132)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test('carga el dashboard con KPIs', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/stats\/overview$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_OVERVIEW) });
      }
      if (/\/api\/stats\/trends$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FAKE_TRENDS) });
      }
      return route.fallback();
    });

    await page.goto('/stats');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('75.0%')).toBeVisible();
    await expect(page.getByText('PLA')).toBeVisible();
    await expect(page.getByText('warping')).toBeVisible();
  });

  test('sin datos en el rango muestra el empty state', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/stats\/overview$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...FAKE_OVERVIEW, prints_done: 0, prints_cancelled: 0 }),
        });
      }
      if (/\/api\/stats\/trends$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ bucket: 'day', series: [] }) });
      }
      return route.fallback();
    });

    await page.goto('/stats');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Sin datos en el rango seleccionado')).toBeVisible();
  });
});
