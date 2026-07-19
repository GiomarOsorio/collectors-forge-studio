/**
 * @file E2E básico de la Bitácora de impresiones (issue #131) — carga de
 * la página, filtros visibles, export CSV dispara la request correcta.
 *
 * @module tests-e2e/print-log.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

function logItem(id, status) {
  return {
    id,
    status,
    position: 0,
    quote_id: null,
    vault_model_id: id,
    project_id: null,
    started_at: null,
    completed_at: null,
    notes: null,
    failure_reason: null,
    failure_category: null,
    batch_id: null,
    scheduled_at: null,
    overdue: false,
    created_by: null,
    created_by_username: 'giomar-dev',
    created_at: '2026-07-10T10:00:00',
    quote: null,
    vault: {
      vault_model_id: id,
      name: `Pieza ${id}`,
      printer_id: null,
      printer_name: null,
      filament_id: null,
      filament_name: null,
      sliced_filament_type: null,
      weight_grams: 20,
      print_time_hours: 1.5,
      quantity: 1,
      print_file_name: null,
    },
  };
}

test.describe('Print Log — bitácora global (issue #131)', () => {
  // Estos tests validan la barra de filtros inline + Exportar CSV, que en
  // el rediseño responsive (#164) viven solo en ≥1024. En <1024 los filtros
  // pasan a un MobileSheet y el export no se expone. Forzamos viewport
  // desktop para probar ese chrome sin importar el project (mobile/desktop).
  test.use({ viewport: { width: 1280, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test('carga la página con resultados y filtros visibles', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (route.request().method() === 'GET' && /\/api\/queue\/log$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [logItem(1, 'pending'), logItem(2, 'done')],
            total: 2,
            page: 1,
            page_size: 25,
          }),
        });
      }
      return route.fallback();
    });

    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Bitácora').first()).toBeVisible();
    await expect(page.getByPlaceholder('Buscar pieza…')).toBeVisible();
    await expect(page.getByText('Pieza 1')).toBeVisible();
    await expect(page.getByText('Pieza 2')).toBeVisible();
    await expect(page.getByRole('button', { name: /exportar csv/i })).toBeVisible();
  });

  test('sin resultados muestra el empty state', async ({ page }) => {
    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Sin resultados')).toBeVisible();
  });

  test('exportar CSV dispara la request con format=csv', async ({ page }) => {
    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');

    const csvRequest = page.waitForRequest(
      (req) => /\/api\/queue\/log/.test(req.url()) && req.url().includes('format=csv'),
    );
    await page.getByRole('button', { name: /exportar csv/i }).click();
    await csvRequest;
  });

  test('preset de fecha "Hoy" queda activo al hacer click', async ({ page }) => {
    await page.goto('/queue/log');
    await page.waitForLoadState('networkidle');

    const hoyBtn = page.getByRole('button', { name: 'Hoy' });
    await hoyBtn.click();
    await expect(hoyBtn).toHaveClass(/teal/);
  });
});
