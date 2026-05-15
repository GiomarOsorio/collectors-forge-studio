/**
 * @file Tests del AppLayout (responsive shell).
 *
 * Verifica que:
 *  - En mobile (useIsMobile=true): renderiza MobileBottomNav, NO renderiza
 *    el hamburger header ni la sidebar fija
 *  - En desktop (useIsMobile=false): renderiza StudioSidebar, NO renderiza
 *    MobileBottomNav, footer "Collector's Forge Studio · Medellín"
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';

// Mocks de dependencias del AppLayout.
vi.mock('../hooks/useMediaQuery', () => ({
  useIsMobile: vi.fn(() => false),
  useMediaQuery: vi.fn(() => false),
}));
vi.mock('../hooks/useBadges', () => ({
  useBadges: vi.fn(() => ({ pendingQueue: 0, lowStock: 0, overdueMaintenance: 0 })),
}));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'giomar', role: 'admin' }, logout: vi.fn() }),
}));

import { useIsMobile } from '../hooks/useMediaQuery';

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={['/inventory/v2']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/inventory/v2" element={<div data-testid="page">Inventory</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppLayout — shell desktop (lg+)', () => {
  beforeEach(() => {
    useIsMobile.mockReturnValue(false);
  });

  it('renderiza StudioSidebar (no MobileBottomNav)', () => {
    renderLayout();
    // StudioSidebar siempre incluye el texto "Collector's Forge"
    expect(screen.getAllByText(/Collector's Forge/i).length).toBeGreaterThan(0);
    // Bottom nav NO debe estar
    expect(screen.queryByText('Mantto')).toBeNull();
  });

  it('renderiza el footer del shell desktop', () => {
    renderLayout();
    expect(screen.getByText(/Medellín, Colombia/i)).toBeInTheDocument();
  });
});

describe('AppLayout — shell mobile (≤lg)', () => {
  beforeEach(() => {
    useIsMobile.mockReturnValue(true);
  });

  it('renderiza MobileBottomNav con los 5 ítems', () => {
    renderLayout();
    expect(screen.getByText('Costos')).toBeInTheDocument();
    expect(screen.getByText('Inventario')).toBeInTheDocument();
    expect(screen.getByText('Cola')).toBeInTheDocument();
    expect(screen.getByText('Slicer')).toBeInTheDocument();
    expect(screen.getByText('Mantto')).toBeInTheDocument();
  });

  it('NO renderiza el footer del shell desktop ni la sidebar', () => {
    renderLayout();
    expect(screen.queryByText(/Medellín, Colombia/i)).toBeNull();
    // Sidebar 'Collector's Forge' aside header no debería aparecer
    const asides = document.querySelectorAll('aside');
    expect(asides.length).toBe(0);
  });

  it('renderiza el contenido de la página (Outlet)', () => {
    renderLayout();
    expect(screen.getByTestId('page')).toHaveTextContent('Inventory');
  });
});
