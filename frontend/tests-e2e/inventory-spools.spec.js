/**
 * @file E2E básico de Bobinas individuales (issue #134) — carga con
 * resultados, empty state, y el flujo de alta masiva hasta la request.
 *
 * @module tests-e2e/inventory-spools.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

function fakeSpool(id, overrides = {}) {
  return {
    id,
    inventory_item_id: 1,
    label_code: `SP-${String(id).padStart(4, '0')}`,
    initial_weight_g: 1000,
    remaining_weight_g: 650,
    percent_remaining: 65,
    cost: 25,
    effective_cost_per_kg: 25,
    extra_colors: null,
    visual_effect: null,
    status: 'active',
    opened_at: null,
    finished_at: null,
    notes: null,
    created_at: '2026-07-01T10:00:00',
    updated_at: '2026-07-01T10:00:00',
    inventory_item_name: 'PLA Negro Marca X',
    color_hex: '#111111',
    color_name: 'Carbon Black',
    filament_type: 'PLA',
    filament_brand: 'Marca X',
    filament_subtype: null,
    ...overrides,
  };
}

const FAKE_FILAMENT_ITEM = {
  id: 1,
  name: 'PLA Negro Marca X',
  category: 'Filamento',
  quantity: 4000,
  min_quantity: 500,
  unit: 'g',
};

test.describe('Inventario — Bobinas (issue #134)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test('carga la página con bobinas', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'GET' && /\/api\/inventory\/spools\/?$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([fakeSpool(1), fakeSpool(2, { label_code: 'SP-0002', percent_remaining: 10 })]),
        });
      }
      if (method === 'GET' && /\/api\/inventory\/spools\/low-stock$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ filament_type: 'PLA', total_remaining_g: 150, threshold_g: 200, below: true }]),
        });
      }
      if (method === 'GET' && /\/api\/inventory\/items\/?$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([FAKE_FILAMENT_ITEM]),
        });
      }
      return route.fallback();
    });

    await page.goto('/inventory/spools');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('SP-0001')).toBeVisible();
    await expect(page.getByText('SP-0002')).toBeVisible();
    // Banner de stock bajo (PLA por debajo del umbral).
    await expect(page.getByText(/Stock bajo/i)).toBeVisible();
  });

  test('sin bobinas muestra el empty state', async ({ page }) => {
    await page.goto('/inventory/spools');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Sin bobinas')).toBeVisible();
  });

  test('alta masiva dispara la request con los datos del form', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'GET' && /\/api\/inventory\/items\/?$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([FAKE_FILAMENT_ITEM]),
        });
      }
      if (method === 'POST' && /\/api\/inventory\/spools\/?$/.test(pathname)) {
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify([fakeSpool(3)]),
        });
      }
      return route.fallback();
    });

    await page.goto('/inventory/spools');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /agregar bobinas/i }).first().click();

    const createRequest = page.waitForRequest(
      (req) => /\/api\/inventory\/spools\/?$/.test(new URL(req.url()).pathname) && req.method() === 'POST',
    );

    await page.getByLabel(/Filamento/).selectOption('1');
    await page.getByRole('button', { name: /crear bobinas/i }).click();

    const req = await createRequest;
    const body = req.postDataJSON();
    expect(body.inventory_item_id).toBe(1);
    expect(body.count).toBe(1);
  });

  test('imprimir etiquetas (issue #135) dispara la request con los ids seleccionados', async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'GET' && /\/api\/inventory\/spools\/?$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([fakeSpool(1), fakeSpool(2, { label_code: 'SP-0002' })]),
        });
      }
      if (method === 'POST' && /\/api\/inventory\/spools\/labels$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/pdf',
          body: Buffer.from('%PDF-fake'),
        });
      }
      return route.fallback();
    });

    await page.goto('/inventory/spools');
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Seleccionar SP-0001').check();
    await page.getByLabel('Seleccionar SP-0002').check();
    await expect(page.getByText('2 bobinas seleccionadas')).toBeVisible();

    await page.getByRole('button', { name: /imprimir etiquetas/i }).click();

    const labelsRequest = page.waitForRequest(
      (req) => /\/api\/inventory\/spools\/labels$/.test(new URL(req.url()).pathname) && req.method() === 'POST',
    );

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: /^imprimir$/i }).click(),
    ]);
    expect(popup).toBeTruthy();

    const req = await labelsRequest;
    const body = req.postDataJSON();
    expect(body.spool_ids).toEqual([1, 2]);
    expect(body.template).toBe('box_62x29');
  });
});
