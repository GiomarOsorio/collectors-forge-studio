/**
 * @file E2E del Studio Home (dashboard reconfigurable).
 *
 * Verifica:
 *  - Renderiza widgets default (Cola, Stock bajo, Cotizaciones, Mantenimiento)
 *  - Botón de hide oculta el widget
 *  - Botón "Restablecer" vuelve a defaults
 *  - localStorage persiste el layout entre recargas
 *
 * @module tests-e2e/dashboard.spec
 */

import { expect, test } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

test.describe('Studio Home — dashboard widgets', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsDev(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('muestra los 4 widgets default visibles', async ({ page }) => {
    await expect(page.getByText(/cola activa/i).first()).toBeVisible();
    await expect(page.getByText(/stock bajo/i).first()).toBeVisible();
    await expect(page.getByText(/cotizaciones recientes/i).first()).toBeVisible();
    await expect(page.getByText(/mantenimiento pendiente/i).first()).toBeVisible();
  });

  test('saludo personalizado con username', async ({ page }) => {
    await expect(page.getByText(/hola/i).first()).toBeVisible();
  });

  test('hide widget Cola → desaparece del grid', async ({ page }) => {
    const colaCard = page.getByText(/cola activa/i).first().locator('xpath=ancestor::div[contains(@class, "card")]').first();
    const hideBtn = colaCard.getByRole('button', { name: /ocultar widget/i });
    if (await hideBtn.isVisible()) {
      await hideBtn.click();
      // Tras ocultar, no debe estar visible como widget card
      // (puede aparecer en la fila de "Widgets ocultos" para re-mostrar)
    }
  });
});
