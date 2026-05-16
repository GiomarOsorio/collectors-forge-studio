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
    // 'Costos', 'Inventario', 'Cola' y 'Slicer' aparecen tanto en bottom nav
    // como en la sidebar drawer — basta con verificar que existe al menos uno.
    expect(screen.getAllByText('Costos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inventario').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cola').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Slicer').length).toBeGreaterThan(0);
    // 'Mantto' es solo de la bottom nav (la sidebar dice 'Mantenimiento')
    expect(screen.getByText('Mantto')).toBeInTheDocument();
  });

  it('NO renderiza el footer del shell desktop', () => {
    renderLayout();
    expect(screen.queryByText(/Medellín, Colombia/i)).toBeNull();
  });

  it('renderiza la sidebar como drawer mobile (initially closed)', () => {
    renderLayout();
    // La sidebar existe como <aside> pero con translate-x-full (drawer
    // cerrado). El page invoca openSidebar() vía useOutletContext para abrirla.
    const aside = document.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside.className).toContain('-translate-x-full');
  });

  it('renderiza el contenido de la página (Outlet)', () => {
    renderLayout();
    expect(screen.getByTestId('page')).toHaveTextContent('Inventory');
  });
});
