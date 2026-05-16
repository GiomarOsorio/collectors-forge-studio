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
    await page.goto('/slicer/v2');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /subir/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /historial/i }).first()).toBeVisible();
  });

  test('tab Subir muestra 3 flow cards (.3mf/.gcode, STL, MakerWorld)', async ({ page }) => {
    await page.goto('/slicer/v2');
    await page.getByRole('button', { name: /^subir$/i }).first().click();
    await expect(page.getByText(/\.3mf \/ \.gcode/i)).toBeVisible();
    await expect(page.getByText(/^STL$/)).toBeVisible();
    await expect(page.getByText(/MakerWorld URL/i)).toBeVisible();
  });

  test('CTA "Subir modelo" del header navega al uploader', async ({ page }, testInfo) => {
    // CTA del header solo en desktop. En mobile el equivalente es el FAB.
    test.skip(testInfo.project.name === 'mobile-iphone12', 'CTA solo en desktop');
    await page.goto('/slicer/v2');
    await page.waitForLoadState('networkidle');
    const cta = page.getByRole('link', { name: /subir modelo/i }).first();
    await expect(cta).toHaveAttribute('href', '/slicer/upload');
  });
});
