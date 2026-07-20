/**
 * @file Screenshot-tests responsive de la Bitácora del Queue (issue #164).
 *
 * PrintLogPage: tabla de 9 columnas → cards en mobile (patrón P2), y los 4
 * filtros apilados → botón "Filtros" que abre un `MobileSheet`.
 *
 *  - <1024: cards (pieza + StatusPill, línea secundaria origen/usuario/cant.,
 *    grid-cols-2 con fecha/impresora/duración/filamento) + sheet de filtros.
 *  - ≥1024: tabla como hoy (ResponsiveTable con overflow-x-auto).
 *
 * Se mockea `/api/queue/log` para que las cards sean deterministas.
 *
 * @module tests-e2e/queue-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FAKE_LOG = {
  total: 3,
  items: [
    {
      id: 1, created_at: '2026-06-28T09:12:00', status: 'done', created_by_username: 'dev-admin',
      quote: { piece_name: 'Soporte en L para letreros', printer_name: 'Bambu Lab A1', weight_grams: 86, print_time_hours: 2.4, quantity: 3 },
    },
    {
      id: 2, created_at: '2026-06-28T08:40:00', status: 'printing', created_by_username: 'giomar',
      vault: { name: 'Toothless dragon flexi', printer_name: 'A1 Mini', weight_grams: 42, print_time_hours: 6.5, quantity: 1, filament_name: 'PETG Midnight' },
    },
    {
      id: 3, created_at: '2026-06-27T15:22:00', status: 'cancelled', created_by_username: 'giomar',
      quote: { piece_name: 'Llavero animalito lila', printer_name: 'A1 Mini', weight_grams: null, print_time_hours: null, quantity: 100 },
    },
  ],
};

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (method === 'GET' && /\/queue\/log$/.test(pathname)) return json(FAKE_LOG);
    if (method === 'GET' && /\/printers\/?$/.test(pathname)) return json([{ id: 1, name: 'Bambu Lab A1' }, { id: 2, name: 'A1 Mini' }]);
    if (method === 'GET' && /\/users\/?$/.test(pathname)) return json([{ id: 1, username: 'dev-admin' }, { id: 2, username: 'giomar' }]);
    return route.fallback();
  });
}

test.describe('Queue responsive — issue #164', () => {
  test('bitácora a 1280px: tabla sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsDev(page);
    await mockApi(page);
    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Soporte en L para letreros')).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);

    await expect(page).toHaveScreenshot('printlog-1280.png', { fullPage: true });
  });

  test('bitácora a 390px: cards, sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await mockApi(page);
    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');

    // Card visible + línea secundaria (origen · usuario · cant.).
    await expect(page.getByText('Soporte en L para letreros')).toBeVisible();
    await expect(page.getByText('cant. 3')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page).toHaveScreenshot('printlog-390.png', { fullPage: true });
  });

  test('bitácora a 390px: botón Filtros abre el sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await mockApi(page);
    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Filtros' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aplicar filtros' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Limpiar' })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page).toHaveScreenshot('printlog-filters-sheet-390.png', { fullPage: true });
  });
});
