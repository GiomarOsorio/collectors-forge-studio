/**
 * @file Tests de InventoryNavTabs — segundo nivel de Inventario como AppTabs
 * de página, fuente de verdad `SIDEBAR_APPS.inventory.items` (config/sidebar.js).
 * Nav consolidada (PR A): Resumen · Bobinas · Herramientas · Consumibles ·
 * Pedidos · Disponible para venta · Importar / Exportar. Bobinas → /inventory/bobinas.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import InventoryNavTabs from '../pages/inventory/InventoryNavTabs';

function renderAt(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="*" element={<InventoryNavTabs />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InventoryNavTabs', () => {
  it('renderiza las 7 rutas canónicas con sus labels', () => {
    renderAt('/inventory');
    for (const label of ['Resumen', 'Bobinas', 'Herramientas', 'Consumibles', 'Pedidos', 'Disponible para venta', 'Importar / Exportar']) {
      expect(screen.getByRole('tab', { name: new RegExp(label) })).toBeInTheDocument();
    }
  });

  it('marca "Resumen" activo en /inventory', () => {
    renderAt('/inventory');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Resumen');
  });

  it('marca "Pedidos" activo en /inventory/purchases', () => {
    renderAt('/inventory/purchases');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Pedidos');
  });

  it('marca "Bobinas" activo en /inventory/bobinas', () => {
    renderAt('/inventory/bobinas');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Bobinas');
  });

  it('click en un tab navega a su ruta canónica', () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={<InventoryNavTabs />} />
          <Route path="/inventory/bobinas" element={<div data-testid="bobinas-page">Bobinas page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Bobinas/ }));
    expect(screen.getByTestId('bobinas-page')).toBeInTheDocument();
  });
});
