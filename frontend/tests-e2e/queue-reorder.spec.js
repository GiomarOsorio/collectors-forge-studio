/**
 * @file E2E de Queue avanzada (issue #133): reorder por drag-and-drop y
 * cambio de tab a Timeline.
 *
 * Sobrescribe `GET /api/queue/` y `PUT /api/queue/reorder` con fixtures
 * propias (3 items pending) DESPUÉS de `loginAsDev` — Playwright prueba
 * los `page.route()` más recientes primero; todo lo que no nos interesa
 * cae con `route.fallback()` al mock genérico de `apiMock.js`.
 *
 * @module tests-e2e/queue-reorder.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

function vaultQueueItem(id, position, name) {
  return {
    id,
    status: 'pending',
    position,
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
    created_at: '2026-07-10T10:00:00',
    quote: null,
    vault: {
      vault_model_id: id,
      name,
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

const QUEUE_ITEMS = [
  vaultQueueItem(101, 0, 'Pieza A'),
  vaultQueueItem(102, 1, 'Pieza B'),
  vaultQueueItem(103, 2, 'Pieza C'),
];

test.describe('Queue — reorder drag-and-drop y tabs (issue #133)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      const method = route.request().method();
      if (method === 'GET' && /\/api\/queue\/?$/.test(pathname)) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(QUEUE_ITEMS),
        });
      }
      if (method === 'PUT' && /\/api\/queue\/reorder$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      return route.fallback();
    });
  });

  test('arrastra el primer item al final de la cola', async ({ page }, testInfo) => {
    // dnd-kit escucha pointermove crudos con activationConstraint.distance;
    // locator.dragTo() mueve el mouse en muy pocos pasos y no dispara
    // suficientes eventos intermedios para que el sensor registre el drag
    // (patrón conocido dnd-kit+Playwright). Simulamos el gesto a mano con
    // mouse.move() en varios pasos pequeños. Táctil en mobile no se ejerce
    // igual — cubierto solo en desktop.
    test.skip(testInfo.project.name === 'mobile-iphone12', 'drag-drop cubierto solo en desktop');

    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Pieza A')).toBeVisible();

    const reorderRequest = page.waitForRequest(
      (req) => /\/api\/queue\/reorder$/.test(new URL(req.url()).pathname) && req.method() === 'PUT',
    );

    const handles = page.locator('[aria-label="Arrastrar para reordenar"]');
    await expect(handles).toHaveCount(3);

    const source = await handles.first().boundingBox();
    const target = await handles.last().boundingBox();
    const start = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
    const end = { x: target.x + target.width / 2, y: target.y + target.height / 2 };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // Primer micro-movimiento para superar activationConstraint.distance (5px).
    await page.mouse.move(start.x, start.y + 8, { steps: 3 });
    const STEPS = 12;
    for (let i = 1; i <= STEPS; i += 1) {
      await page.mouse.move(
        start.x + ((end.x - start.x) * i) / STEPS,
        start.y + ((end.y - start.y) * i) / STEPS,
        { steps: 3 },
      );
      await page.waitForTimeout(40);
    }
    await page.mouse.up();

    const req = await reorderRequest;
    const body = req.postDataJSON();
    expect(body.item_ids).toHaveLength(3);
    // El item 101 (Pieza A, arrastrado) ya no debe quedar primero.
    expect(body.item_ids[0]).not.toBe(101);
  });

  test('cambia a la pestaña Timeline', async ({ page }) => {
    await page.goto('/queue');
    await page.waitForLoadState('networkidle');
    // Desktop usa AppTabs (issue #160, role="tab"); el shell mobile mantiene
    // su propio selector con <button>. El locator cubre ambos.
    await page
      .getByRole('tab', { name: /timeline/i })
      .or(page.getByRole('button', { name: /timeline/i }))
      .first()
      .click();
    await expect(page.getByText(/sin impresoras registradas/i)).toBeVisible();
  });
});
