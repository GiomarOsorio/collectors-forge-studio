import { test, expect } from '@playwright/test';
import { loginAsDev } from './helpers/auth.js';

const FILAMENTS = [
  // stock OK pero marcado a mano → debe mostrar "COMPRAR"
  { id: 1, category: 'Filamento', name: 'Marcado', color_name: 'Marcado', color_hex: '#3B82F6',
    filament_type: 'PLA', quantity: 1000, weight_per_roll: 1000, min_quantity: 200, min_spools: 0,
    sealed_spools: 1, open_remaining_g: null, needs_purchase: true, price_per_kg: 20 },
  // stock OK, sin marcar → sin badge
  { id: 2, category: 'Filamento', name: 'Normal', color_name: 'Normal', color_hex: '#10B981',
    filament_type: 'PLA', quantity: 1000, weight_per_roll: 1000, min_quantity: 200, min_spools: 0,
    sealed_spools: 1, open_remaining_g: null, needs_purchase: false, price_per_kg: 20 },
];

async function mock(page) {
  await page.route('**/api/**', async (route) => {
    const { pathname } = new URL(route.request().url());
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    if (/\/inventory\/items\/?$/.test(pathname)) return json(FILAMENTS);
    if (/\/inventory\/spools\/?$/.test(pathname)) return json([]);
    if (/\/inventory\/spools\/low-stock$/.test(pathname)) return json([]);
    if (/\/purchase-orders\/?$/.test(pathname) || /\/purchases\/?$/.test(pathname)) return json([]);
    return route.fallback();
  });
}

test('needs_purchase manual muestra badge COMPRAR aunque el stock esté OK', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsDev(page);
  await mock(page);
  await page.goto('/inventory/bobinas');
  await page.waitForLoadState('networkidle');

  // El ítem marcado aparece con badge COMPRAR
  await expect(page.getByText('COMPRAR').first()).toBeVisible();
  // Aparece en el grupo "Stock bajo" (que trae el link Comprar)
  await expect(page.getByText('Stock bajo').first()).toBeVisible();
});
