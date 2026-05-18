/**
 * @file Visual regression de las pantallas v2 (port Claude Design).
 *
 * Captura screenshot de cada página principal en desktop + mobile y
 * compara contra baseline en `__screenshots__/`. Si hay diff > 2% del
 * área, falla y se adjunta diff PNG.
 *
 * Para regenerar baseline cuando un cambio visual es intencional:
 *   `npx playwright test --update-snapshots tests-e2e/visual.spec.js`
 *
 * @module tests-e2e/visual.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const PAGES = [
  { path: '/', name: 'studio-home' },
  { path: '/inventory', name: 'inventory' },
  { path: '/cost', name: 'cost' },
  { path: '/cost/calculator/v2', name: 'calculator' },
  { path: '/slicer', name: 'slicer' },
  { path: '/queue', name: 'queue' },
  { path: '/maintenance', name: 'maintenance' },
  { path: '/vault', name: 'vault' },
];

test.describe('Visual regression — pantallas v2', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
  });

  for (const { path, name } of PAGES) {
    test(`${name} pixel-match baseline`, async ({ page }) => {
      await page.goto(path);
      // Espera a que termine de cargar el spinner inicial de Suspense.
      await page.waitForLoadState('networkidle');
      // Animaciones desactivadas por config — captura full page.
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
      });
    });
  }
});
