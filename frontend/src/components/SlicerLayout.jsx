/**
 * @file Layout principal de la aplicación Slicer dentro de TurtleForge Studio.
 *
 * Extiende el layout base con:
 * - Botón en el logo/turtle que abre el AppSwitcherDrawer para cambiar de app
 * - Todas las rutas de navegación con prefijo /slicer/*
 * - Sidebar hamburger en pantallas < xl
 * - Color identificador amber (#F59E0B)
 *
 * @module components/SlicerLayout
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppSwitcherDrawer from './AppSwitcherDrawer';
import { Upload, History, LogOut, Menu } from 'lucide-react';

/**
 * Elementos del menú de navegación con prefijo /slicer/.
 * @type {Array<{to: string, icon: React.ComponentType, label: string}>}
 */
const navItems = [
  { to: '/slicer/upload', icon: Upload, label: 'Subir modelo' },
  { to: '/slicer/history', icon: History, label: 'Historial' },
];

/**
 * Layout de la aplicación Slicer.
 *
 * @returns {JSX.Element}
 */
export default function SlicerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-forge-black">
      {/* Overlay oscuro en mobile cuando la sidebar está abierta */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* AppSwitcher drawer */}
      <AppSwitcherDrawer
        isOpen={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
      />

      {/* Barra lateral de navegación */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0d1014] text-tech-white flex flex-col transition-transform duration-300 border-r border-[#1e2125] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        {/* Encabezado: logo abre el AppSwitcher */}
        <div className="p-6 border-b border-[#1e2125]">
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity text-left group"
            title="Cambiar de aplicación"
            aria-label="Abrir menú de aplicaciones"
          >
            <img src="/logo.png" alt="TurtleForge" className="h-10 w-10 object-contain group-hover:scale-105 transition-transform" />
            <div>
              <h1 className="text-xl font-bold text-tech-white">TurtleForge Slicer</h1>
              <p className="text-gunmetal text-xs group-hover:text-amber-400 transition-colors">TurtleForge Studio ↗</p>
            </div>
          </button>
        </div>

        {/* Menú de navegación */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-amber-400/10 text-amber-400 font-medium'
                    : 'text-steel hover:bg-[#1e2125] hover:text-tech-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Pie: usuario y logout */}
        <div className="p-4 border-t border-[#1e2125]">
          <div className="flex items-center justify-between">
            <NavLink
              to="/cost/account"
              onClick={closeSidebar}
              className="text-gunmetal hover:text-tech-white text-sm transition-colors"
              title="Mi cuenta"
            >
              {user?.username}
            </NavLink>
            <button
              onClick={handleLogout}
              className="text-gunmetal hover:text-tech-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Área de contenido principal */}
      <div className="flex-1 flex flex-col xl:ml-64">
        {/* Header con hamburger en mobile */}
        <header className="xl:hidden bg-[#0d1014] text-tech-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 border-b border-[#1e2125]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-steel hover:text-tech-white"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            title="Cambiar de aplicación"
          >
            <img src="/logo.png" alt="TurtleForge" className="h-7 w-7 object-contain" />
            <h1 className="text-lg font-bold text-tech-white">TurtleForge Slicer</h1>
          </button>
        </header>

        {/* Contenido de la página activa */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 md:p-6 xl:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-[#0d1014] border-t border-[#1e2125] py-2 px-6 text-center shrink-0">
          <p className="text-gunmetal text-xs">TurtleForge Studio · Medellín, Colombia</p>
        </footer>
      </div>
    </div>
  );
}
