/**
 * @file Tests del componente MobileBottomNav (Claude Design port).
 *
 * Verifica que:
 *  - Renderiza los 5 ítems esperados (Costos / Inventario / Cola / Slicer / Mantto)
 *  - Cada ítem es un enlace navegable a `/<app>`
 *  - El ítem cuya ruta coincide con `location` recibe estilo active
 *  - El badge sale cuando `useBadges` retorna count > 0
 *  - La nav está oculta en ≥lg con `lg:hidden` (responsive)
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from '../components/MobileBottomNav';

// Mock del hook useBadges para controlar los counters sin disparar fetch.
vi.mock('../hooks/useBadges', () => ({
  useBadges: vi.fn(() => ({ pendingQueue: 0, lowStock: 0, overdueMaintenance: 0 })),
}));

import { useBadges } from '../hooks/useBadges';

function renderNav(initialEntries = ['/inventory']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MobileBottomNav />
    </MemoryRouter>,
  );
}

describe('MobileBottomNav — design fidelity', () => {
  beforeEach(() => {
    useBadges.mockReturnValue({ pendingQueue: 0, lowStock: 0, overdueMaintenance: 0 });
  });

  it('renderiza los 5 ítems del design (Costos / Inventario / Cola / Slicer / Mantto)', () => {
    renderNav();
    expect(screen.getByText('Costos')).toBeInTheDocument();
    expect(screen.getByText('Inventario')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByText('Slicer')).toBeInTheDocument();
    expect(screen.getByText('Mantto')).toBeInTheDocument();
  });

  it('cada ítem es un link a /<app>', () => {
    renderNav();
    expect(screen.getByText('Costos').closest('a')).toHaveAttribute('href', '/cost');
    expect(screen.getByText('Inventario').closest('a')).toHaveAttribute('href', '/inventory');
    expect(screen.getByText('Cola').closest('a')).toHaveAttribute('href', '/queue');
    expect(screen.getByText('Slicer').closest('a')).toHaveAttribute('href', '/slicer');
    expect(screen.getByText('Mantto').closest('a')).toHaveAttribute('href', '/maintenance');
  });

  it('marca el ítem activo según la ruta actual (aria-current=page)', () => {
    renderNav(['/inventory']);
    const inventoryLink = screen.getByText('Inventario').closest('a');
    expect(inventoryLink).toHaveAttribute('aria-current', 'page');
    const costLink = screen.getByText('Costos').closest('a');
    expect(costLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('muestra badge de cola pendiente cuando count > 0', () => {
    useBadges.mockReturnValue({ pendingQueue: 4, lowStock: 0, overdueMaintenance: 0 });
    renderNav();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('muestra badge de mantenimiento vencido (warn) cuando count > 0', () => {
    useBadges.mockReturnValue({ pendingQueue: 0, lowStock: 0, overdueMaintenance: 2 });
    renderNav();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renderiza 99+ cuando el count excede 99', () => {
    useBadges.mockReturnValue({ pendingQueue: 150, lowStock: 0, overdueMaintenance: 0 });
    renderNav();
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('usa la clase lg:hidden para esconderse en desktop', () => {
    const { container } = renderNav();
    const nav = container.querySelector('nav');
    expect(nav?.className).toContain('lg:hidden');
  });
});
