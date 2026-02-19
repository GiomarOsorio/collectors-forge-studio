/**
 * @file Tests del componente Layout — responsividad y hamburger menu.
 *
 * Verifica que la sidebar tenga las clases CSS correctas para cada
 * breakpoint (xl: para sidebar fija, hamburger visible en <xl),
 * y que el comportamiento de abrir/cerrar funcione correctamente.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/Layout';

// Mock del contexto de autenticación
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'giomar' }, logout: vi.fn() }),
}));

// Mock del Outlet de React Router (las páginas hijas)
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet-content">Contenido de página</div>,
  };
});

/**
 * Renderiza el Layout dentro de un MemoryRouter para satisfacer
 * los hooks de React Router (NavLink, useNavigate, Outlet).
 */
const renderLayout = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Layout />
    </MemoryRouter>
  );

describe('Layout — Sidebar responsiva', () => {
  it('renderiza el botón hamburger en el DOM', () => {
    renderLayout();
    const hamburger = screen.getByRole('button', { name: /abrir menú/i });
    expect(hamburger).toBeInTheDocument();
  });

  it('el header mobile tiene clase xl:hidden (oculto en desktop)', () => {
    renderLayout();
    const hamburger = screen.getByRole('button', { name: /abrir menú/i });
    // El header que contiene el hamburger debe tener xl:hidden
    const header = hamburger.closest('header');
    expect(header).toHaveClass('xl:hidden');
  });

  it('la sidebar empieza cerrada en mobile (clase -translate-x-full)', () => {
    renderLayout();
    const aside = document.querySelector('aside');
    // Cuando sidebarOpen=false, la clase dinámica es -translate-x-full
    expect(aside.className).toContain('-translate-x-full');
  });

  it('la sidebar tiene xl:translate-x-0 para ser visible en desktop', () => {
    renderLayout();
    const aside = document.querySelector('aside');
    expect(aside.className).toContain('xl:translate-x-0');
  });

  it('al hacer click en hamburger la sidebar se abre (translate-x-0)', () => {
    renderLayout();
    const hamburger = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(hamburger);
    const aside = document.querySelector('aside');
    // Cuando sidebarOpen=true el className dinámico cambia a translate-x-0
    expect(aside.className).toContain('translate-x-0');
    expect(aside.className).not.toContain('-translate-x-full');
  });

  it('el overlay aparece cuando la sidebar está abierta', () => {
    renderLayout();
    // Antes de abrir: overlay no está en el DOM
    expect(document.querySelector('.bg-black\\/50')).toBeNull();
    const hamburger = screen.getByRole('button', { name: /abrir menú/i });
    fireEvent.click(hamburger);
    // Después de abrir: overlay sí está
    expect(document.querySelector('.fixed.inset-0')).toBeInTheDocument();
  });

  it('el overlay tiene xl:hidden (desaparece en desktop)', () => {
    renderLayout();
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
    // El overlay es el div con bg-black/50 que cubre toda la pantalla
    const overlays = document.querySelectorAll('.fixed.inset-0');
    // Filtramos el que es el overlay (no la sidebar)
    const overlay = Array.from(overlays).find(
      (el) => el.tagName === 'DIV' && el.className.includes('xl:hidden')
    );
    expect(overlay).toBeInTheDocument();
  });

  it('hacer click en el overlay cierra la sidebar', () => {
    renderLayout();
    // Abre la sidebar
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
    const aside = document.querySelector('aside');
    expect(aside.className).toContain('translate-x-0');
    // Hace click en el overlay
    const overlay = Array.from(document.querySelectorAll('.fixed.inset-0')).find(
      (el) => el.tagName === 'DIV' && el.className.includes('xl:hidden')
    );
    fireEvent.click(overlay);
    // La sidebar vuelve a estar cerrada
    expect(aside.className).toContain('-translate-x-full');
  });

  it('el área de contenido principal tiene xl:ml-64 (margen solo en desktop)', () => {
    renderLayout();
    const outlet = screen.getByTestId('outlet-content');
    // Subimos hasta el contenedor que tiene xl:ml-64
    const contentWrapper = outlet.closest('.flex-1.flex.flex-col');
    expect(contentWrapper).toHaveClass('xl:ml-64');
  });

  it('el contenido tiene max-w-7xl para limitar el ancho en 2K/4K', () => {
    renderLayout();
    const outlet = screen.getByTestId('outlet-content');
    const contentInner = outlet.closest('.max-w-7xl');
    expect(contentInner).toBeInTheDocument();
    expect(contentInner).toHaveClass('mx-auto');
  });

  it('al navegar a una ruta la sidebar se cierra automáticamente', () => {
    renderLayout();
    // Abre sidebar
    fireEvent.click(screen.getByRole('button', { name: /abrir menú/i }));
    // Hace click en un NavLink (ej: Filamentos)
    const navLinks = screen.getAllByRole('link');
    fireEvent.click(navLinks[0]);
    const aside = document.querySelector('aside');
    expect(aside.className).toContain('-translate-x-full');
  });

  it('la sidebar contiene todos los items de navegación', () => {
    renderLayout();
    expect(screen.getByText('Calculadora')).toBeInTheDocument();
    expect(screen.getByText('Filamentos')).toBeInTheDocument();
    expect(screen.getByText('Insumos')).toBeInTheDocument();
    expect(screen.getByText('Impresoras')).toBeInTheDocument();
    expect(screen.getByText('Historial')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
  });

  it('muestra el nombre de usuario en el pie de la sidebar', () => {
    renderLayout();
    expect(screen.getByText('giomar')).toBeInTheDocument();
  });
});
