/**
 * @file E2E inventory mobile — flujos críticos del diseño Claude Design.
 *
 * Sólo corre en proyecto `mobile-iphone12` (iPhone 12 viewport).
 *
 * @module tests-e2e/inventory-mobile.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Inventory mobile — Claude Design fidelity', () => {
  test.skip(({ browserName }, testInfo) => testInfo.project.name !== 'mobile-iphone12',
    'Solo proyecto mobile');

  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.goto('/inventory/v2');
    await page.waitForLoadState('networkidle');
  });

  test('renderiza shell mobile (hero gradient + mini KPIs + tabs + bottom nav)', async ({ page }) => {
    // Hero card con "Capital invertido"
    await expect(page.getByText(/capital invertido/i)).toBeVisible();
    // Mini KPI strip: Material, Stock bajo, Compras
    await expect(page.getByText('Material').first()).toBeVisible();
    await expect(page.getByText(/stock bajo/i).first()).toBeVisible();
    // Tabs con labels abreviados
    await expect(page.getByRole('button', { name: /filamentos/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /herram\./i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /consum\./i }).first()).toBeVisible();
    // Bottom nav con 5 ítems
    const nav = page.getByRole('navigation', { name: /navegación principal/i });
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Costos')).toBeVisible();
    await expect(nav.getByText('Inventario')).toBeVisible();
    await expect(nav.getByText('Cola')).toBeVisible();
    await expect(nav.getByText('Slicer')).toBeVisible();
    await expect(nav.getByText('Mantto')).toBeVisible();
  });

  test('NO renderiza search bar entre tabs y lista (design fidelity)', async ({ page }) => {
    // Hay tabs visibles
    await expect(page.getByRole('button', { name: /filamentos/i }).first()).toBeVisible();
    // Pero ningún input de búsqueda en filamentos tab
    const searchInputs = page.locator('input[placeholder*="batch"], input[placeholder*="ubicación"]');
    await expect(searchInputs).toHaveCount(0);
  });

  test('FAB visible a la derecha + sobre la bottom nav', async ({ page }) => {
    const fab = page.getByRole('button', { name: /agregar/i });
    await expect(fab).toBeVisible();
    // Debe estar visualmente cerca del bottom (no en top header)
    const box = await fab.boundingBox();
    expect(box?.y).toBeGreaterThan(500);
  });

  test('tap en tab Insumos cambia tab y mantiene bottom nav', async ({ page }) => {
    await page.getByRole('button', { name: /insumos/i }).first().click();
    // El header in-page muestra "Insumos"
    await expect(page.getByRole('heading', { name: /insumos/i })).toBeVisible();
    // Bottom nav sigue ahí
    await expect(page.getByRole('navigation', { name: /navegación principal/i })).toBeVisible();
  });

  test('cambio entre apps via bottom nav', async ({ page }) => {
    await page.getByRole('navigation', { name: /navegación principal/i }).getByText('Cola').click();
    await page.waitForURL('**/queue/v2');
    expect(page.url()).toContain('/queue/v2');
  });
});
