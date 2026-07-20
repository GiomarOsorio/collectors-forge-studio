/**
 * @file Layout único de Collector's Forge Studio.
 *
 * Estrategia responsive (alineada con `useIsMobile` = ≤1023px):
 *  - **Desktop (≥1024px)**: sidebar fija a la izquierda (StudioSidebar) + main
 *    con `lg:ml-64`. Header de página vive dentro de cada Page.
 *  - **Mobile (≤1023px)**: SIN sidebar fija. La navegación entre apps la hace
 *    `MobileBottomNav` fija al pie de pantalla. Cada Page con `MobileAppHeader`
 *    provee su propio ☰ 44×44 integrado (issue #161, P7) — el FAB hamburger
 *    global solo se muestra como fallback en páginas V1 que no lo montan
 *    (`hasOwnHeader` se actualiza vía `registerMobileHeader` en outletContext,
 *    que `MobileAppHeader` llama al montar/desmontar).
 *
 * Sustituye a los 8 layouts por app anteriores.
 *
 * @module components/AppLayout
 */

import { Suspense, useCallback, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Breadcrumb from './Breadcrumb';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import MobileBottomNav from './MobileBottomNav';
import StudioSidebar from './StudioSidebar';
import { useIsMobile } from '../hooks/useMediaQuery';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';

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
  const { helpOpen, closeHelp } = useKeyboardShortcuts();

  // Issue #161: cuántos MobileAppHeader hay montados ahora mismo. Contador
  // (no boolean) por si una página anida más de uno transitoriamente durante
  // un cambio de ruta — el FAB solo reaparece cuando llega a 0.
  const [ownHeaderCount, setOwnHeaderCount] = useState(0);
  const registerMobileHeader = useCallback((mounted) => {
    setOwnHeaderCount((n) => Math.max(0, n + (mounted ? 1 : -1)));
  }, []);

  // Contexto compartido para que las páginas puedan abrir la sidebar mobile
  // desde su propio botón de menú (replica el `onMenu` del design).
  const outletContext = { openSidebar: () => setSidebarOpen(true), registerMobileHeader };

  // ── Shell mobile (≤1023px) ───────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="min-h-screen bg-forge-black flex flex-col">
        {/* Sidebar como drawer mobile — abre via FAB hamburger global o
            desde el botón menú de páginas que lo dispararon ellas mismas. */}
        <StudioSidebar open={sidebarOpen} onClose={closeSidebar} />

        {/* Issue #53 — hamburger global flotante, fallback para páginas V1
            que no montan su propio MobileAppHeader. Issue #161: cuando una
            página SÍ lo monta, este FAB se oculta (ownHeaderCount > 0) para
            no encimarse visualmente con el ☰ 44×44 ya integrado ahí. */}
        {ownHeaderCount === 0 && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="fixed top-3 left-3 z-40 w-11 h-11 rounded-lg inline-flex items-center justify-center bg-[var(--color-surf-card)]/95 backdrop-blur border border-[var(--color-border-strong)] text-tech-white shadow-lg hover:bg-[var(--color-surf-hover)] transition-colors"
          >
            <Menu size={18} />
          </button>
        )}

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 pt-2 px-3">
          <Suspense fallback={<PageFallback />}>
            <Outlet context={outletContext} />
          </Suspense>
        </main>
        <MobileBottomNav />
        {/* Fix #168: el modal de atajos de teclado (#140) es desktop-only —
            no hay teclado físico ni forma de dispararlo en mobile, así que no
            se monta en este shell. */}
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
              <Outlet context={outletContext} />
            </Suspense>
          </div>
        </main>

        <footer className="bg-surf-sidebar border-t border-border py-2 px-6 text-center shrink-0">
          <p className="text-gunmetal text-xs">Collector's Forge Studio · Medellín, Colombia</p>
        </footer>
      </div>
      {helpOpen && <KeyboardShortcutsModal onClose={closeHelp} />}
    </div>
  );
}
