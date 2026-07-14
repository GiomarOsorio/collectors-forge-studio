/**
 * @file E2E básico de Recordatorios de mantenimiento (issue #138) — pestaña
 * "Programados" de MaintenancePage, alta desde preset y badge de sidebar.
 *
 * @module tests-e2e/maintenance-schedules.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FAKE_PRINTER = {
  id: 1, name: 'P2S del estudio', model: 'BambuLab P2S Combo',
  purchase_price: 800, power_consumption_watts: 350,
  estimated_lifespan_hours: 10000, current_hours: 350,
};

function fakeSchedule(id, overrides = {}) {
  return {
    id,
    printer_id: 1,
    printer_name: 'P2S del estudio',
    task_name: 'Lubricar ejes XY',
    description: null,
    interval_type: 'print_hours',
    interval_value: 300,
    last_done_at: '2026-01-01T00:00:00',
    last_done_hours: 0,
    enabled: true,
    created_at: '2026-01-01T00:00:00',
    updated_at: '2026-01-01T00:00:00',
    progress_pct: 116.7,
    status: 'overdue',
    ...overrides,
  };
}

test.describe('Mantenimiento — Recordatorios (issue #138)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test('pestaña Programados muestra recordatorios con status', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'GET' && /\/api\/printers\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([FAKE_PRINTER]) });
      }
      if (method === 'GET' && /\/api\/maintenance\/schedules\/due$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeSchedule(1)]) });
      }
      if (method === 'GET' && /\/api\/maintenance\/schedules\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([fakeSchedule(1)]) });
      }
      return route.fallback();
    });

    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Programados/i }).click();
    await expect(page.getByText('Lubricar ejes XY')).toBeVisible();
    await expect(page.getByText('Vencido')).toBeVisible();
  });

  test('alta masiva desde preset dispara la request con el payload correcto', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'GET' && /\/api\/printers\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([FAKE_PRINTER]) });
      }
      if (method === 'GET' && /\/api\/maintenance\/schedules\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      }
      if (method === 'POST' && /\/api\/maintenance\/schedules\/?$/.test(pathname)) {
        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(fakeSchedule(2, { status: 'ok', progress_pct: 0 })) });
      }
      return route.fallback();
    });

    await page.goto('/maintenance');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /Programados/i }).click();

    await page.getByRole('button', { name: 'Crear el primero' }).click();

    const createRequest = page.waitForRequest(
      (req) => /\/api\/maintenance\/schedules\/?$/.test(new URL(req.url()).pathname) && req.method() === 'POST',
    );

    await page.getByRole('button', { name: 'Tensar correas' }).click();
    await page.getByRole('button', { name: 'Crear recordatorio' }).click();

    const req = await createRequest;
    const body = req.postDataJSON();
    expect(body.task_name).toBe('Tensar correas');
    expect(body.interval_value).toBe(500);
  });
});
