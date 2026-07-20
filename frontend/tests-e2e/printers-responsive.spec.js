/**
 * @file E2E del rediseño de PrintersPage (audit 1:1 cost.html §Impresoras).
 * Card con icono + specs + barra "uso de vida útil" + form P6 dual.
 *
 * @module tests-e2e/printers-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const PRINTERS = [
  { id: 1, name: 'Bambu Lab A1', model: 'A1 · FDM 256³', purchase_price: 1150000, power_consumption_watts: 110, estimated_lifespan_hours: 5000, current_hours: 1240, notes: 'AMS lite instalado.' },
  { id: 2, name: 'Bambu Lab P1S', model: 'P1S · cámara cerrada', purchase_price: 2480000, power_consumption_watts: 180, estimated_lifespan_hours: 6000, current_hours: 5200, notes: null },
];

test.describe('PrintersPage responsive (audit 1:1)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/printers\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PRINTERS) });
      }
      return route.fallback();
    });
  });

  test('desktop 1280px: cards con barra de uso de vida útil', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/cost/printers');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Bambu Lab A1')).toBeVisible();
    await expect(page.getByText('Uso de vida útil').first()).toBeVisible();
    await expect(page.getByText('87%')).toBeVisible(); // 5200/6000 → warn
    await page.screenshot({ path: 'test-results/printers-desktop-1280.png' });
  });

  test('mobile 390px: form abre en MobileSheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/cost/printers');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /agregar impresora/i }).click();
    await expect(page.getByText('Nueva impresora')).toBeVisible();
    await page.screenshot({ path: 'test-results/printers-form-mobile-390.png' });
  });
});
