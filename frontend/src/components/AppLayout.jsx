/**
 * @file Layout único de Collector's Forge Studio.
 *
 * Sustituye a los 8 layouts por app (CostLayout, InventoryLayout, etc.) que
 * existían antes del refactor de UI inspirado en bambuddy. Ahora hay una sola
 * sidebar global (`StudioSidebar`) y todas las apps usan este wrapper.
 *
 * @module components/AppLayout
 */

import { Suspense, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Breadcrumb from './Breadcrumb';
import StudioSidebar from './StudioSidebar';

/** Spinner mientras carga un `lazy(() => import(...))`. */
const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-7 h-7 border-2 border-forge-teal/20 border-t-forge-teal rounded-full animate-spin" />
  </div>
);

/**
 * Wrapper común para todas las páginas autenticadas.
 *
 * @returns {JSX.Element}
 */
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-forge-black">
      <StudioSidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 flex flex-col min-w-0 xl:ml-64">
        {/* Header mobile: hamburger + logo */}
        <header className="xl:hidden bg-[#0A0E16] text-tech-white px-4 py-3 flex items-center gap-3 sticky top-0 z-20 border-b border-[#222630]">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-steel hover:text-tech-white shrink-0"
            aria-label="Abrir menú"
          >
            <Menu size={24} />
          </button>
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 min-w-0">
            <img src="/logo.png" alt="Collector's Forge" className="h-7 w-7 object-contain shrink-0" />
            <h1 className="text-lg font-bold text-tech-white truncate">Studio</h1>
          </Link>
        </header>

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

        <footer className="bg-[#0A0E16] border-t border-[#222630] py-2 px-6 text-center shrink-0">
          <p className="text-gunmetal text-xs">Collector's Forge Studio · Medellín, Colombia</p>
        </footer>
      </div>
    </div>
  );
}
