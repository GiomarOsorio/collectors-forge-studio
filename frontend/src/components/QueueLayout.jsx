/**
 * @file Layout principal de la aplicación Queue dentro de TurtleForge Studio.
 *
 * Sidebar con navegación a las secciones de la cola de impresión (/queue/*).
 * El logo tortuga abre el AppSwitcherDrawer para cambiar de app.
 *
 * @module components/QueueLayout
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppSwitcherDrawer from './AppSwitcherDrawer';
import {
  ListOrdered,
  Clock,
  LogOut,
  Menu,
} from 'lucide-react';

/** Color de la app Queue */
const APP_COLOR = '#14B8A6';

/**
 * Elementos del menú de navegación de la app Queue.
 */
const navItems = [
  { to: '/queue/',       icon: ListOrdered, label: 'Cola activa' },
  { to: '/queue/history', icon: Clock,       label: 'Historial'   },
];

/**
 * Layout de la aplicación Queue.
 * @returns {JSX.Element}
 */
export default function QueueLayout() {
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
      {/* Overlay en mobile */}
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

      {/* Barra lateral */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0d1014] text-tech-white flex flex-col transition-transform duration-300 border-r border-[#1e2125] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        {/* Encabezado: logo abre AppSwitcher */}
        <div className="p-6 border-b border-[#1e2125]">
          <button
            onClick={() => setSwitcherOpen(true)}
            className="flex items-center gap-3 w-full hover:opacity-80 transition-opacity text-left group"
            title="Cambiar de aplicación"
          >
            <img src="/logo.png" alt="TurtleForge" className="h-10 w-10 object-contain group-hover:scale-105 transition-transform" />
            <h1 className="text-xl font-bold text-tech-white">Queue</h1>
          </button>
        </div>

        {/* Menú */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/queue/'}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-teal-500/10 text-teal-400 font-medium'
                    : 'text-steel hover:bg-[#1e2125] hover:text-tech-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Pie */}
        <div className="p-4 border-t border-[#1e2125]">
          <div className="flex items-center justify-between">
            <NavLink
              to="/settings/account"
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

      {/* Área principal */}
      <div className="flex-1 flex flex-col xl:ml-64">
        {/* Header mobile */}
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
          >
            <img src="/logo.png" alt="TurtleForge" className="h-7 w-7 object-contain" />
            <h1 className="text-lg font-bold text-tech-white">Queue</h1>
          </button>
        </header>

        {/* Contenido */}
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
