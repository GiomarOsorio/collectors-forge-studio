/**
 * @file Layout mínimo para la página principal de TurtleForge Studio.
 *
 * Solo muestra un header con el logo y el nombre del estudio,
 * más el área de contenido (Outlet) donde vive la página de inicio.
 *
 * @module components/StudioLayout
 */

import { Outlet, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

/**
 * Layout de la pantalla principal de TurtleForge Studio.
 *
 * @returns {JSX.Element}
 */
export default function StudioLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-forge-black flex flex-col">
      {/* Header */}
      <header className="bg-[#0d1014] border-b border-[#1e2125] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <img src="/logo.png" alt="TurtleForge" className="h-9 w-9 object-contain" />
          <div>
            <h1 className="text-lg font-bold text-tech-white leading-none">TurtleForge Studio</h1>
            <p className="text-xs text-gunmetal">Panel de aplicaciones</p>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            to="/settings/account"
            className="text-gunmetal hover:text-tech-white text-sm hidden sm:block transition-colors"
            title="Mi cuenta"
          >
            {user?.username}
          </Link>
          <button
            onClick={handleLogout}
            className="tf-btn-ghost"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#0d1014] border-t border-[#1e2125] py-2 px-6 text-center">
        <p className="text-gunmetal text-xs">TurtleForge Studio · Medellín, Colombia</p>
      </footer>
    </div>
  );
}
