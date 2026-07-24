/**
 * @file E2E responsive de Settings + editor de templates (issue #168).
 *
 * - Settings index (`/settings`): shell dual; el AccountFormDrawer trae el
 *   form de contraseña `grid-cols-1 sm:grid-cols-2` (P8).
 * - CompanyTemplateEditorPage (`/company/templates/new`): editor Liquid con
 *   toolbar sticky, zoom de fuente A−/A+ y botones Validar/Preview ≥44px.
 *
 * @module tests-e2e/settings-responsive.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Settings responsive (issue #168)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/users\/?$/.test(pathname)) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      return route.fallback();
    });
  });

  test('desktop 1280px: index + drawer de cuenta', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Mi cuenta').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/settings-desktop-1280.png' });
  });

  test('mobile 390px: form de contraseña apila (grid-cols-1)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // El tab "Cuenta" es el activo por defecto; el form de cuenta (con la
    // sección "Cambiar contraseña") se renderiza inline, sin abrir drawer.
    await expect(page.getByText('Cambiar contraseña')).toBeVisible();
    await page.screenshot({ path: 'test-results/settings-account-mobile-390.png' });
  });
});

test.describe('Template editor responsive (issue #168)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.route('**/api/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (/\/api\/company\/templates\/default-template$/.test(pathname)) {
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ content: '<!DOCTYPE html>\n<html><body>{{ piece_name }}</body></html>' }),
        });
      }
      return route.fallback();
    });
  });

  test('desktop 1280px: toolbar + zoom de fuente', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/company/templates/new');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: 'Validar' })).toBeVisible();
    await expect(page.getByRole('button', { name: /aumentar tamaño/i })).toBeVisible();
    await page.screenshot({ path: 'test-results/template-editor-desktop-1280.png' });
  });

  test('mobile 390px: editor usable (A+ sube la fuente)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/company/templates/new');
    await page.waitForLoadState('networkidle');

    const textarea = page.locator('textarea').first();
    const before = await textarea.evaluate((el) => getComputedStyle(el).fontSize);
    await page.getByRole('button', { name: /aumentar tamaño/i }).click();
    const after = await textarea.evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));
    await page.screenshot({ path: 'test-results/template-editor-mobile-390.png' });
  });
});
