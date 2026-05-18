/**
 * @file E2E del flujo Slicer: ver historial, navegar a uploader,
 * "Usar en calculadora" pasa weight + time como query params.
 *
 * @module tests-e2e/slicer-flow.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Slicer — flujos críticos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  test('renderiza tabs Subir + Historial', async ({ page }) => {
    await page.goto('/slicer');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /subir/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /historial/i }).first()).toBeVisible();
  });

  test('tab Subir muestra los 3 flujos (.3mf/.gcode, STL, MakerWorld)', async ({ page }) => {
    await page.goto('/slicer');
    await page.getByRole('button', { name: /^subir$/i }).first().click();
    await expect(page.getByText(/\.3mf \/ \.gcode/i)).toBeVisible();
    await expect(page.getByText(/^STL$/)).toBeVisible();
    // En el nuevo SlicerUploadPanel el flujo MakerWorld aparece como un input
    // + heading "Importar desde MakerWorld" (antes era una flow card aparte).
    await expect(page.getByText(/MakerWorld/i).first()).toBeVisible();
  });

  test('CTA "Subir modelo" del header switchea al tab Subir (sin navegar)', async ({ page }, testInfo) => {
    // CTA del header solo en desktop. En mobile el equivalente es el FAB.
    test.skip(testInfo.project.name === 'mobile-iphone12', 'CTA solo en desktop');
    await page.goto('/slicer');
    await page.waitForLoadState('networkidle');
    // Tras la limpieza de UI vieja, ya no es un <Link to="/slicer/upload"> —
    // ahora es un <button> que hace setTab('subir') in-page.
    const cta = page.getByRole('button', { name: /subir modelo/i }).first();
    await expect(cta).toBeVisible();
    await cta.click();
    // El upload panel inline aparece (no hay navegación, sigue en /slicer).
    await expect(page).toHaveURL(/\/slicer$/);
    await expect(page.getByText(/suelta tu modelo/i)).toBeVisible();
  });
});
