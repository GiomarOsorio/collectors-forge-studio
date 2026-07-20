/**
 * @file E2E del árbol de carpetas del Vault (issue #180).
 *
 * - ≥1280: panel de árbol a la izquierda de la galería (expandido).
 * - <1024: botón «Carpetas» abre el árbol en un MobileSheet.
 *
 * @module tests-e2e/vault-folder-tree.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FOLDERS = [
  { id: 1, name: 'MakerWorld', parent_id: null, file_count: 3 },
  { id: 2, name: 'Sagas', parent_id: 1, file_count: 2 },
  { id: 3, name: 'Clientes', parent_id: null, file_count: 12 },
];

function mockVault(page) {
  return page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    if (/\/api\/vault\/folders$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FOLDERS) });
    }
    if (/\/api\/vault\/stats$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ used_bytes: 1048576, quota_bytes: 10485760, percent: 10 }) });
    }
    if (/\/api\/vault\/tags$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
    if (/\/api\/vault\/?$/.test(pathname)) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0, page: 1, page_size: 24 }) });
    }
    return route.fallback();
  });
}

test.describe('Vault folder tree (issue #180)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await mockVault(page);
  });

  test('desktop 1280px: panel del árbol junto a la galería', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Todos los modelos')).toBeVisible();
    await expect(page.getByText('MakerWorld').first()).toBeVisible();
    // Chevron expande sin navegar: al abrir MakerWorld aparece Sagas.
    await page.getByLabel('Expandir').first().click();
    await expect(page.getByText('Sagas')).toBeVisible();
    await page.screenshot({ path: 'test-results/vault-tree-desktop-1280.png' });
  });

  test('mobile 390px: botón Carpetas abre el árbol en sheet', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/vault');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /ver árbol de carpetas/i }).click();
    await expect(page.getByText('Todos los modelos')).toBeVisible();
    await expect(page.getByText('MakerWorld').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/vault-tree-mobile-390.png' });
  });
});
