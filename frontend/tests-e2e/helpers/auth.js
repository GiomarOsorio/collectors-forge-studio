/**
 * @file Helpers Playwright para auth bypass + setup común.
 *
 * El bypass dev (DEV_BYPASS_TOKEN en AuthContext) permite saltar OIDC en
 * tests automatizados. Sólo activo cuando `import.meta.env.DEV === true`
 * (vite dev server) — en producción la pantalla bypass no existe.
 *
 * `loginAsDev` también activa el mock de `/api/*` (apiMock.js) para que
 * los tests no dependan de un backend real corriendo en CI.
 *
 * @module tests-e2e/helpers/auth
 */

import { mockApi } from './apiMock.js';

/**
 * Activa mock de API + inicia sesión via bypass dev. Espera a que aterrice
 * en el Studio Home.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function loginAsDev(page) {
  await mockApi(page);
  await page.goto('/login');
  const bypassBtn = page.getByRole('button', { name: /bypass dev/i });
  await bypassBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await bypassBtn.click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}

/**
 * Inyecta el token de bypass directamente en localStorage para evitar
 * el flow visual de login (más rápido para suites grandes).
 *
 * @param {import('@playwright/test').Page} page
 */
export async function seedBypassToken(page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.setItem('token', 'dev-bypass');
  });
}
