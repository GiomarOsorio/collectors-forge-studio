/**
 * @file Tests del AppLayout (responsive shell).
 *
 * Verifica que:
 *  - En mobile (useIsMobile=true): renderiza MobileBottomNav, NO la sidebar
 *    fija; el FAB hamburger (fallback) solo aparece si la página no monta su
 *    propio `MobileAppHeader` (issue #161, evita colisión visual P7)
 *  - En desktop (useIsMobile=false): renderiza StudioSidebar, NO renderiza
 *    MobileBottomNav, footer "Collector's Forge Studio · Medellín"
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import MobileAppHeader from '../components/MobileAppHeader';

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

function renderLayout(pageElement = <div data-testid="page">Inventory</div>) {
  return render(
    <MemoryRouter initialEntries={['/inventory']}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/inventory" element={pageElement} />
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

  it('renderiza MobileBottomNav con los 4 ítems', () => {
    renderLayout();
    // 'Costos', 'Inventario' y 'Cola' aparecen tanto en bottom nav
    // como en la sidebar drawer — basta con verificar que existe al menos uno.
    expect(screen.getAllByText('Costos').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inventario').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cola').length).toBeGreaterThan(0);
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

// ─── Issue #161: FAB hamburger vs MobileAppHeader propio ───────────────────

describe('AppLayout — FAB hamburger (P7, issue #161)', () => {
  beforeEach(() => {
    useIsMobile.mockReturnValue(true);
  });

  it('muestra el FAB global cuando la página NO monta MobileAppHeader (fallback V1)', () => {
    renderLayout(<div data-testid="page">Legacy sin header propio</div>);
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
  });

  it('oculta el FAB global cuando la página monta su propio MobileAppHeader', () => {
    renderLayout(
      <MobileAppHeader appName="Inventario" title="Filamentos" onMenu={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).toBeNull();
    // El botón de menú ahora vive integrado en el header, 44×44.
    const menuBtn = screen.getByRole('button', { name: 'Menú' });
    expect(menuBtn.className).toContain('w-11');
    expect(menuBtn.className).toContain('h-11');
  });

  it('el FAB reaparece si el MobileAppHeader se desmonta (cambio de página)', () => {
    const { rerender } = render(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route
              path="/inventory"
              element={<MobileAppHeader appName="Inventario" title="Filamentos" onMenu={() => {}} />}
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: 'Abrir menú' })).toBeNull();

    rerender(
      <MemoryRouter initialEntries={['/inventory']}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/inventory" element={<div>Sin header</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Abrir menú' })).toBeInTheDocument();
  });
});
