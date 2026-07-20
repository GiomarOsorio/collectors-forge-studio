/**
 * @file E2E responsive de Mantenimiento (issue #166) — verifica el layout
 * en mobile (390px) y desktop (1280px): AppTabs, tarjetas de impresora y el
 * LogFormDrawer con LineItems en modo `stacked` (card apilada en todos los
 * anchos — el drawer es angosto ~480px también en ≥1024).
 *
 * @module tests-e2e/maintenance-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const PRINTER = {
  id: 1,
  name: 'P2S del estudio',
  model: 'BambuLab P2S Combo',
  purchase_price: 800,
  power_consumption_watts: 350,
  estimated_lifespan_hours: 10000,
  current_hours: 1240,
};

const SUMMARY = [
  {
    printer: PRINTER,
    last_per_type: {
      lubrication: { hours_since: 420, done_at: '2026-05-01T00:00:00' },
      nozzle: { hours_since: 90, done_at: '2026-07-01T00:00:00' },
    },
  },
];

function mockApi(page) {
  return page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    if (method === 'GET' && /\/api\/maintenance\/summary\/?$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SUMMARY) });
    }
    if (method === 'GET' && /\/api\/maintenance\/logs\/?$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    if (method === 'GET' && /\/api\/printers\/?$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([PRINTER]) });
    }
    if (method === 'GET' && /\/api\/inventory/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
    return route.fallback();
  });
}

test.describe('Mantenimiento responsive (issue #166)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await mockApi(page);
  });

  test('desktop 1280px: dashboard con tarjetas de impresora', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('P2S del estudio').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/maintenance-desktop-1280.png' });
  });

  test('mobile 390px: tabs + tarjeta impresora apiladas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('P2S del estudio').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/maintenance-mobile-390.png' });
  });

  test('LogFormDrawer: LineItems como card apilada en 390px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /registrar/i }).first().click();
    await expect(page.getByPlaceholder(/Grasa sintética/).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/maintenance-drawer-mobile-390.png' });
  });

  test('LogFormDrawer: LineItems apilada (stacked) tambien en 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /registrar/i }).first().click();
    await expect(page.getByPlaceholder(/Grasa sintética/).first()).toBeVisible();
    await page.screenshot({ path: 'test-results/maintenance-drawer-desktop-1280.png' });
  });
});
