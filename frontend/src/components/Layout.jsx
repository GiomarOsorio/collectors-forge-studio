/**
 * @file Componente de layout principal de Calculator3D.
 *
 * Define la estructura visual de la aplicacion con un diseno de
 * barra lateral (sidebar) y area de contenido principal.
 * La barra lateral contiene la navegacion principal con enlaces
 * a todas las secciones de la aplicacion, asi como la informacion
 * del usuario y el boton de cerrar sesion.
 *
 * En pantallas menores a xl (1280px) la sidebar se oculta y se accede
 * mediante un boton hamburger. En xl: (1280px+) la sidebar siempre es visible.
 *
 * El contenido de cada pagina se renderiza dentro del Outlet de React Router.
 *
 * @module components/Layout
 */

import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Calculator,
  FileEdit,
  Layers,
  Printer,
  History,
  Settings,
  LogOut,
  Package,
  Menu,
} from 'lucide-react';

/**
 * @typedef {Object} NavItem
 * @property {string} to - Ruta de destino del enlace
 * @property {React.ComponentType} icon - Componente de icono de lucide-react
 * @property {string} label - Texto visible del enlace de navegacion
 */

/**
 * Configuracion de los elementos del menu de navegacion lateral.
 * Cada entrada define una ruta, su icono correspondiente y la etiqueta visible.
 * @type {NavItem[]}
 */
const navItems = [
  { to: '/', icon: Calculator, label: 'Calculadora' },
  { to: '/manual', icon: FileEdit, label: 'Cotiz. Manual' },
  { to: '/filaments', icon: Layers, label: 'Filamentos' },
  { to: '/supplies', icon: Package, label: 'Insumos' },
  { to: '/printers', icon: Printer, label: 'Impresoras' },
  { to: '/history', icon: History, label: 'Historial' },
  { to: '/settings', icon: Settings, label: 'Configuración' },
];

/**
 * Componente de layout principal de la aplicacion.
 *
 * @description Renderiza la estructura de dos columnas:
 * - Barra lateral izquierda (sidebar) con navegacion, logo y cerrar sesion
 * - Area de contenido principal donde se renderizan las paginas hijas via Outlet
 *
 * En pantallas menores a xl (<1280px) la sidebar se muestra como overlay al presionar
 * el boton hamburger. En xl: (1280px+) la sidebar es siempre visible y fija a la izquierda.
 *
 * @returns {JSX.Element} Layout completo con sidebar y area de contenido
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  /** @type {[boolean, Function]} Controla si la sidebar esta abierta en mobile */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * Maneja el cierre de sesion del usuario.
   * Limpia la sesion a traves del contexto y redirige a la pagina de login.
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /** Cierra la sidebar (usado al navegar o al hacer click en el overlay) */
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-forge-black">
      {/* Overlay oscuro en mobile cuando la sidebar esta abierta */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 xl:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Barra lateral de navegacion */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0d1014] text-tech-white flex flex-col transition-transform duration-300 border-r border-[#1e2125] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} xl:translate-x-0`}>
        {/* Encabezado con logo y nombre de la aplicacion */}
        <div className="p-6 border-b border-[#1e2125]">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="TurtleForge" className="h-10 w-10 object-contain" />
            <div>
              <h1 className="text-xl font-bold text-tech-white">TurtleForge Cost</h1>
              <p className="text-gunmetal text-sm">TurtleForge Studio</p>
            </div>
          </div>
        </div>
        {/* Menu de navegacion: resalta la ruta activa con fondo verde */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-forge-green/10 text-forge-green font-medium'
                    : 'text-steel hover:bg-[#1e2125] hover:text-tech-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {/* Pie de la barra lateral: nombre de usuario y boton de logout */}
        <div className="p-4 border-t border-[#1e2125]">
          <div className="flex items-center justify-between">
            <span className="text-gunmetal text-sm">{user?.username}</span>
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

      {/* Area de contenido principal */}
      <div className="flex-1 flex flex-col xl:ml-64">
        {/* Header con hamburger: visible en todas las pantallas menores a xl (1280px) */}
        <header className="xl:hidden bg-[#0d1014] text-tech-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 border-b border-[#1e2125]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-steel hover:text-tech-white"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
          <img src="/logo.png" alt="TurtleForge" className="h-7 w-7 object-contain" />
          <h1 className="text-lg font-bold text-tech-white">TurtleForge Cost</h1>
        </header>

        {/* Contenido de la pagina activa */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 md:p-6 xl:p-8 max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
