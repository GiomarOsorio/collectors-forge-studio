/**
 * @file Screenshot-tests responsive del Vault (issue #163).
 *
 * Cubre los dos modales secundarios que no tenían rama mobile pese a
 * abrirse desde la galería:
 *  - PrintHistoryModal (P2+P6): <1024 pasa de una tabla de 6 columnas en
 *    modal centrado a un `MobileSheet` con cards (fecha, estado, impresora,
 *    filamento, cantidad, gramos, motivo).
 *  - Galería sin regresión en 390 y 1280.
 *
 * El sheet de historial se prueba con la API de print-history mockeada
 * para que las cards sean deterministas (no depende del seed).
 *
 * @module tests-e2e/vault-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FAKE_FILE = {
  id: 1, name: 'Soporte en L para letreros', created_at: '2026-06-28T10:00:00',
  is_print_ready: true, print_count: 3, source_file_size: 2_400_000,
  print_file_size: 5_100_000, folder_id: null, tags: [],
};

const FAKE_HISTORY = {
  total_grams: 249,
  success_rate_pct: 67,
  items: [
    {
      id: 1, created_at: '2026-06-28T10:00:00', status: 'done',
      printer_name: 'Bambu P1S #2', filament_name: 'PETG Roble',
      quantity: 2, weight_grams: 42, failure_category: null, failure_reason: null,
    },
    {
      id: 2, created_at: '2026-06-14T10:00:00', status: 'cancelled',
      printer_name: 'Bambu P1S #1', filament_name: 'PETG Midnight',
      quantity: 1, weight_grams: 39, failure_category: 'adhesion', failure_reason: 'warping en esquina',
    },
    {
      id: 3, created_at: '2026-06-02T10:00:00', status: 'done',
      printer_name: 'Bambu P1S #2', filament_name: 'PETG Roble',
      quantity: 3, weight_grams: 42, failure_category: null, failure_reason: null,
    },
  ],
};

test.describe('Vault responsive — issue #163', () => {
  test('galería a 390px: sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);
    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page).toHaveScreenshot('vault-gallery-390.png', { fullPage: true });
  });

  test('galería a 1280px: sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsDev(page);
    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(1280);

    await expect(page).toHaveScreenshot('vault-gallery-1280.png', { fullPage: true });
  });

  test('historial a 390px: sheet con cards, sin overflow-x', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsDev(page);

    // Mock del surface del Vault para que la card tenga print_count>0 (así
    // aparece el badge "3 impresiones" que abre el historial) y el historial
    // sea determinista. IMPORTANTE: registrar la route DESPUÉS de loginAsDev
    // — su navegación inicial descarta las rutas registradas antes.
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (method === 'GET' && /\/vault\/\d+\/print-history$/.test(pathname)) return json(FAKE_HISTORY);
      if (method === 'GET' && /\/vault\/?$/.test(pathname)) return json([FAKE_FILE]);
      if (method === 'GET' && /\/vault\/stats$/.test(pathname)) return json({ used_bytes: 7_500_000, quota_bytes: 1_000_000_000, percent: 0.75 });
      if (method === 'GET' && /\/vault\/folders$/.test(pathname)) return json([]);
      if (method === 'GET' && /\/vault\/tags$/.test(pathname)) return json([]);
      return route.fallback();
    });

    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    await page.getByTitle('Ver historial de impresiones').first().click();

    // Cabecera del sheet + una card visible (motivo de fallo del ítem 2).
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('warping en esquina')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);

    await expect(page).toHaveScreenshot('vault-history-sheet-390.png', { fullPage: true });
  });

  test('historial a 1280px: drawer lateral (no modal centrado)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginAsDev(page);

    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      if (method === 'GET' && /\/vault\/\d+\/print-history$/.test(pathname)) return json(FAKE_HISTORY);
      if (method === 'GET' && /\/vault\/?$/.test(pathname)) return json([FAKE_FILE]);
      if (method === 'GET' && /\/vault\/stats$/.test(pathname)) return json({ used_bytes: 7_500_000, quota_bytes: 1_000_000_000, percent: 0.75 });
      if (method === 'GET' && /\/vault\/folders$/.test(pathname)) return json([]);
      if (method === 'GET' && /\/vault\/tags$/.test(pathname)) return json([]);
      return route.fallback();
    });

    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    await page.getByTitle('Ver historial de impresiones').first().click();

    // El drawer (P6) va anclado al borde derecho: su caja arranca en la mitad
    // derecha del viewport, a diferencia de un modal centrado.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByText('warping en esquina')).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.x).toBeGreaterThan(640);
    expect(box.x + box.width).toBeGreaterThanOrEqual(1279);

    // Viewport (no fullPage): el drawer es position:fixed y fullPage lo
    // descoloca en Playwright.
    await expect(page).toHaveScreenshot('vault-history-drawer-1280.png');
  });
});
