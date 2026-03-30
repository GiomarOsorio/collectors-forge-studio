/**
 * @file Layout unificado para las apps de TurtleForge Studio.
 *
 * Reemplaza los 7 layouts individuales (CostLayout, InventoryLayout, etc.)
 * con un componente parametrizable. Diferencia entre apps con AppSwitcher
 * (Cost, Inventory, Queue, Maintenance, Company, Slicer) y sin él (Settings).
 *
 * Mejoras vs. los layouts anteriores:
 * - Sublabel "TurtleForge Studio" en la cabecera del sidebar
 * - Botón de logout con tf-btn-ghost (touch target ≥ 44px)
 * - Animación fadeInUp en el área de contenido
 * - Breadcrumb de navegación
 *
 * @module components/AppLayout
 */

import { useState, Suspense } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppSwitcherDrawer from './AppSwitcherDrawer';
import { LogOut, Menu } from 'lucide-react';
import Breadcrumb from './Breadcrumb';

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-7 h-7 border-2 border-forge-teal/20 border-t-forge-teal rounded-full animate-spin" />
  </div>
);

/**
 * Layout unificado para apps de TurtleForge Studio.
 *
 * @param {Object} props
 * @param {string} props.appName - Nombre de la app mostrado en el sidebar (ej. "Cost", "Archive")
 * @param {Array<{to:string, icon:React.ComponentType, label:string, end?:boolean}>} props.navItems
 * @param {string} props.activeClass - Clases Tailwind para el enlace activo (ej. "bg-forge-teal/10 text-forge-teal")
 * @param {boolean} [props.useAppSwitcher=true] - false en Settings (el logo vuelve a "/")
 * @returns {JSX.Element}
 */
export default function AppLayout({ appName, navItems, activeClass, useAppSwitcher = true }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  /** Contenido interno del logo en el sidebar (compartido entre button y Link) */
  const logoInner = (
    <>
      <img
        src="/logo.png"
        alt="TurtleForge"
        className="h-10 w-10 object-contain shrink-0 group-hover:scale-105 transition-transform"
      />
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-gunmetal leading-none mb-1 uppercase tracking-widest">
          TurtleForge Studio
        </p>
        <h1 className="text-lg font-bold text-tech-white leading-none truncate">{appName}</h1>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-forge-black">
      {/* Overlay oscuro en mobile cuando la sidebar está abierta */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* AppSwitcher drawer (solo apps con switcher) */}
      {useAppSwitcher && (
        <AppSwitcherDrawer isOpen={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      )}

      {/* Barra lateral de navegación */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0E16] text-tech-white flex flex-col transition-transform duration-300 border-r border-[#222630] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>

        {/* Encabezado: abre AppSwitcher o vuelve al Studio Home */}
        <div className="p-5 border-b border-[#222630]">
          {useAppSwitcher ? (
            <button
              onClick={() => setSwitcherOpen(true)}
              className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity text-left group"
              title="Cambiar de aplicación"
              aria-label="Abrir menú de aplicaciones"
            >
              {logoInner}
            </button>
          ) : (
            <Link
              to="/"
              className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity group"
              title="Volver a TurtleForge Studio"
            >
              {logoInner}
            </Link>
          )}
        </div>

        {/* Menú de navegación */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? `${activeClass} font-medium`
                    : 'text-steel hover:bg-[#222630] hover:text-tech-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Pie: nombre de usuario y logout */}
        <div className="p-4 border-t border-[#222630]">
          <div className="flex items-center justify-between gap-2">
            <NavLink
              to="/settings/account"
              onClick={closeSidebar}
              className="text-gunmetal hover:text-tech-white text-sm transition-colors truncate"
              title="Mi cuenta"
            >
              {user?.username}
            </NavLink>
            <button
              onClick={handleLogout}
              className="tf-btn-ghost shrink-0"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Área de contenido principal */}
      <div className="flex-1 flex flex-col xl:ml-64">
        {/* Header con hamburger: visible en pantallas menores a xl */}
        <header className="xl:hidden bg-[#0A0E16] text-tech-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 border-b border-[#222630]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-steel hover:text-tech-white shrink-0"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
          {useAppSwitcher ? (
            <button
              onClick={() => setSwitcherOpen(true)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0"
              title="Cambiar de aplicación"
            >
              <img src="/logo.png" alt="TurtleForge" className="h-7 w-7 object-contain shrink-0" />
              <h1 className="text-lg font-bold text-tech-white truncate">{appName}</h1>
            </button>
          ) : (
            <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-w-0">
              <img src="/logo.png" alt="TurtleForge" className="h-7 w-7 object-contain shrink-0" />
              <h1 className="text-lg font-bold text-tech-white truncate">{appName}</h1>
            </Link>
          )}
        </header>

        {/* Contenido de la página activa */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div
            className="p-4 md:p-6 xl:p-8 max-w-7xl mx-auto w-full min-h-full"
            style={{ animation: 'fadeInUp 0.3s ease-out both' }}
          >
            <Breadcrumb />
            <Suspense fallback={<PageFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-[#0A0E16] border-t border-[#222630] py-2 px-6 text-center shrink-0">
          <p className="text-gunmetal text-xs">TurtleForge Studio · Medellín, Colombia</p>
        </footer>
      </div>
    </div>
  );
}
