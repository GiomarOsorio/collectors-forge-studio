/**
 * @file E2E inventory mobile — nav consolidada (una sola sub-nav).
 *
 * Sólo corre en proyecto `mobile-iphone12` (iPhone 12 viewport).
 *
 * PR A consolidó el doble sub-nav en uno solo (InventoryNavTabs, role=tab):
 * Resumen · Bobinas · Herramientas · Consumibles · Pedidos · Disponible ·
 * Importar/Exportar. /inventory = Resumen (overview); /inventory/bobinas = la
 * lista de filamentos. Insumos y el tab in-page Compras se soft-deletearon.
 *
 * @module tests-e2e/inventory-mobile.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Inventory mobile — nav consolidada', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-iphone12', 'Solo proyecto mobile');
    await loginAsDev(page);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
  });

  test('Resumen: hero + mini KPIs + sub-nav único + bottom nav', async ({ page }) => {
    // Hero card con "Capital invertido"
    await expect(page.getByText(/capital invertido/i)).toBeVisible();
    // Mini KPI strip: Material, Stock bajo
    await expect(page.getByText('Material').first()).toBeVisible();
    await expect(page.getByText(/stock bajo/i).first()).toBeVisible();
    // Un solo sub-nav (InventoryNavTabs, role=tab) con los items consolidados
    await expect(page.getByRole('tab', { name: /Resumen/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Bobinas/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Herramientas/ })).toBeVisible();
    // Insumos ya NO existe
    await expect(page.getByRole('tab', { name: /^Insumos$/ })).toHaveCount(0);
    // Bottom nav con sus ítems
    const nav = page.getByRole('navigation', { name: /navegación principal/i });
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Inventario')).toBeVisible();
    await expect(nav.getByText('Cola')).toBeVisible();
  });

  test('Bobinas: sin search bar entre nav y lista (design fidelity)', async ({ page }) => {
    await page.goto('/inventory/bobinas');
    await page.waitForLoadState('networkidle');
    // Ningún input de búsqueda inline en la vista bobinas (search vive en overlay)
    const searchInputs = page.locator('input[placeholder*="batch"], input[placeholder*="ubicación"]');
    await expect(searchInputs).toHaveCount(0);
  });

  test('Bobinas: FAB visible sobre la bottom nav', async ({ page }) => {
    await page.goto('/inventory/bobinas');
    await page.waitForLoadState('networkidle');
    const fab = page.getByRole('button', { name: /agregar/i });
    await expect(fab).toBeVisible();
    const box = await fab.boundingBox();
    expect(box?.y).toBeGreaterThan(500);
  });

  test('nav a Herramientas cambia de sección y mantiene bottom nav', async ({ page }) => {
    await page.getByRole('tab', { name: /Herramientas/ }).click();
    await page.waitForURL('**/inventory/herramientas');
    expect(page.url()).toContain('/inventory/herramientas');
    await expect(page.getByRole('navigation', { name: /navegación principal/i })).toBeVisible();
  });

  test('cambio entre apps via bottom nav', async ({ page }) => {
    await page.getByRole('navigation', { name: /navegación principal/i }).getByText('Cola').click();
    await page.waitForURL('**/queue');
    expect(page.url()).toContain('/queue');
  });
});
