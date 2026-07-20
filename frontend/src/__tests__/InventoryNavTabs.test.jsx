/**
 * @file Tests de InventoryNavTabs (issue #181) — segundo nivel de Inventario
 * como AppTabs de página, fuente de verdad `SIDEBAR_APPS.inventory.items`
 * (config/sidebar.js). Verifica las 5 rutas canónicas y la navegación real.
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
  it('renderiza las 5 rutas canónicas con sus labels', () => {
    renderAt('/inventory');
    for (const label of ['Resumen', 'Pedidos', 'Disponible para venta', 'Bobinas', 'Importar / Exportar']) {
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

  it('marca "Bobinas" activo en /inventory/spools', () => {
    renderAt('/inventory/spools');
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Bobinas');
  });

  it('click en un tab navega a su ruta canónica', () => {
    render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route path="/inventory" element={<InventoryNavTabs />} />
          <Route path="/inventory/spools" element={<div data-testid="spools-page">Bobinas page</div>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Bobinas/ }));
    expect(screen.getByTestId('spools-page')).toBeInTheDocument();
  });
});
