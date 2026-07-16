/**
 * @file Tests de StudioSidebar tras el issue #181 (sidebar = SOLO apps).
 *
 * Verifica que la sección secundaria de subnav (Galería/Papelera,
 * Cotizaciones/Impresoras, etc.) ya no se renderiza dentro de la sidebar,
 * sin importar la ruta activa — el segundo nivel de cada app vive ahora
 * como `AppTabs` en el contenido de la página (ver InventoryNavTabs.test.jsx,
 * QUEUE_TABS/VAULT_TABS en sus respectivas páginas).
 */

import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StudioSidebar from '../components/StudioSidebar';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'giomar', role: 'admin' }, logout: vi.fn() }),
}));
vi.mock('../hooks/useBadges', () => ({
  useBadges: vi.fn(() => ({ pendingQueue: 0, lowStock: 0, overdueMaintenance: 0 })),
}));

function renderSidebarAt(pathname) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route path="*" element={<StudioSidebar open onClose={() => {}} />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudioSidebar — solo apps (issue #181)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renderiza las 8 apps de primer nivel', () => {
    renderSidebarAt('/');
    const aside = document.querySelector('aside');
    const nav = within(aside);
    for (const name of ['Cost', 'Inventario', 'Mantenimiento', 'Queue', 'Vault', 'Proyectos', 'Stats', 'Compañía']) {
      expect(nav.getByText(name)).toBeInTheDocument();
    }
  });

  it('en /vault NO muestra subnav (Galería/Papelera/Subir modelo)', () => {
    renderSidebarAt('/vault');
    const aside = document.querySelector('aside');
    expect(within(aside).queryByText('Galería')).toBeNull();
    expect(within(aside).queryByText('Papelera')).toBeNull();
    expect(within(aside).queryByText('Subir modelo')).toBeNull();
  });

  it('en /cost NO muestra subnav (Cotizaciones/Impresoras/Nueva cotización)', () => {
    renderSidebarAt('/cost');
    const aside = document.querySelector('aside');
    expect(within(aside).queryByText('Cotizaciones')).toBeNull();
    expect(within(aside).queryByText('Impresoras')).toBeNull();
    expect(within(aside).queryByText('Nueva cotización')).toBeNull();
  });

  it('en /queue NO muestra subnav (Bitácora)', () => {
    renderSidebarAt('/queue');
    const aside = document.querySelector('aside');
    expect(within(aside).queryByText('Bitácora')).toBeNull();
  });

  it('en /inventory/purchases NO muestra subnav (Pedidos/Bobinas/Importar)', () => {
    renderSidebarAt('/inventory/purchases');
    const aside = document.querySelector('aside');
    expect(within(aside).queryByText('Pedidos')).toBeNull();
    expect(within(aside).queryByText('Bobinas')).toBeNull();
    expect(within(aside).queryByText(/Importar/)).toBeNull();
  });

  it('el footer con Configuración sigue accesible (gear ⚙️)', () => {
    renderSidebarAt('/');
    expect(screen.getByLabelText('Configuración')).toBeInTheDocument();
  });
});
