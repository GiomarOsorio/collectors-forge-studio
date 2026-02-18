/**
 * @file Componente de layout principal de Calculator3D.
 *
 * Define la estructura visual de la aplicacion con un diseno de
 * barra lateral (sidebar) y area de contenido principal.
 * La barra lateral contiene la navegacion principal con enlaces
 * a todas las secciones de la aplicacion, asi como la informacion
 * del usuario y el boton de cerrar sesion.
 *
 * El contenido de cada pagina se renderiza dentro del Outlet de React Router.
 *
 * @module components/Layout
 */

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Calculator,
  Layers,
  Printer,
  History,
  Settings,
  LogOut,
  Package,
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
 * La barra lateral destaca visualmente la seccion activa usando NavLink de React Router.
 * El nombre del usuario autenticado se muestra en la parte inferior de la barra lateral.
 *
 * @returns {JSX.Element} Layout completo con sidebar y area de contenido
 */
export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  /**
   * Maneja el cierre de sesion del usuario.
   * Limpia la sesion a traves del contexto y redirige a la pagina de login.
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Barra lateral de navegacion */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        {/* Encabezado con el nombre de la aplicacion */}
        <div className="p-6 border-b border-gray-700">
          <h1 className="text-xl font-bold">Calculator3D</h1>
          <p className="text-gray-400 text-sm mt-1">Costos de impresión 3D</p>
        </div>
        {/* Menu de navegacion: resalta la ruta activa con fondo azul */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {/* Pie de la barra lateral: nombre de usuario y boton de logout */}
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{user?.username}</span>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Area de contenido principal: renderiza la pagina activa */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
