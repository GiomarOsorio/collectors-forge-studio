/**
 * @file Layout único de Collector's Forge Studio.
 *
 * Estrategia responsive (alineada con `useIsMobile` = ≤1023px):
 *  - **Desktop (≥1024px)**: sidebar fija a la izquierda (StudioSidebar) + main
 *    con `lg:ml-64`. Header de página vive dentro de cada Page.
 *  - **Mobile (≤1023px)**: SIN sidebar ni hamburger. La navegación entre apps
 *    la hace `MobileBottomNav` fija al pie de pantalla. Cada Page provee su
 *    propio header con breadcrumb badge + acciones.
 *
 * Sustituye a los 8 layouts por app anteriores.
 *
 * @module components/AppLayout
 */

import { Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';
import MobileBottomNav from './MobileBottomNav';
import StudioSidebar from './StudioSidebar';
import { useIsMobile } from '../hooks/useMediaQuery';

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
  const isMobile = useIsMobile();
  // En desktop la sidebar se controla como drawer en pantallas medianas
  // (md-lg, antes del cambio a 1024px) y como fija desde lg+.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = () => setSidebarOpen(false);

  // ── Shell mobile (≤1023px) ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen bg-forge-black flex flex-col">
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
        <MobileBottomNav />
      </div>
    );
  }

  // ── Shell desktop (≥1024px) ──────────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-forge-black">
      <StudioSidebar open={sidebarOpen} onClose={closeSidebar} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
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
