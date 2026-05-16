/**
 * @file E2E del flow de login y bypass dev.
 *
 * Verifica:
 *  - `/login` muestra el botón de SSO + el botón "Bypass dev" en dev mode
 *  - Click en bypass redirige a `/` (Studio Home)
 *  - Cualquier ruta privada sin token redirige a `/login`
 *
 * @module tests-e2e/auth.spec
 */

import { expect, test } from '@playwright/test';
import { mockApi } from './helpers/apiMock.js';

test.describe('Auth — login + bypass dev', () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test('muestra ambos botones en /login (dev mode)', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /bypass dev/i })).toBeVisible();
  });

  test('bypass dev inyecta token y redirige a Studio Home', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /bypass dev/i }).click();
    await page.waitForURL('/');
    // Studio Home muestra "Hola" en el saludo
    await expect(page.getByText(/hola/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('ruta privada sin token redirige a /login', async ({ page }) => {
    await page.goto('/inventory/v2');
    await page.waitForURL((url) => url.pathname === '/login', { timeout: 10_000 });
    await expect(page.getByRole('button', { name: /bypass dev/i })).toBeVisible();
  });
});
