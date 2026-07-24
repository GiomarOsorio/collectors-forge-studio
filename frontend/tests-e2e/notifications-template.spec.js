/**
 * @file E2E del editor de templates de notificaciones (audit 1:1) —
 * chips de inserción de variables por evento (settings.html §Editor de template).
 *
 * @module tests-e2e/notifications-template.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Notifications template chips (audit 1:1)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/notifications\/channels$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      if (/\/api\/notifications\/templates\//.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '✅ {{ piece_name }} listo' }) });
      }
      return route.fallback();
    });
  });

  test('desktop 1280px: chips insertan la variable en el editor', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await page.getByText('Notificaciones', { exact: true }).first().click();
    // Chip de una variable del evento por defecto (queue.item_done).
    const chip = page.getByRole('button', { name: '{{ printer }}' });
    await expect(chip).toBeVisible();

    const textarea = page.locator('textarea').first();
    await textarea.click();
    await chip.click();
    await expect(textarea).toHaveValue(/\{\{ printer \}\}/);
    await page.screenshot({ path: 'test-results/notifications-chips-1280.png' });
  });
});
