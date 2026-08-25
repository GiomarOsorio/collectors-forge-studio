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

  // IMPORTANTE: mobile y desktop comparten UN SOLO árbol con el mismo
  // `<Suspense><Outlet/></Suspense>` en idéntica posición estructural. Tener
  // dos `return` con Outlets distintos hacía que, al cruzar 1023px
  // redimensionando/maximizando la ventana, React desmontara un árbol y
  // montara el otro → la página activa se remontaba desde cero y perdía TODO
  // su estado (form, archivo .gcode importado en la calculadora, etc.).
  // Los wrappers exclusivos de desktop usan `display:contents` en mobile para
  // no alterar el layout sin romper la identidad del fiber del Outlet.
  return (
    <div className={isMobile ? 'min-h-screen bg-forge-black flex flex-col' : 'flex min-h-screen bg-forge-black'}>
      {/* Desktop: sidebar fija. Mobile: drawer abierto via FAB / botón menú. */}
      <StudioSidebar open={sidebarOpen} onClose={closeSidebar} />

      {/* Issue #53 — hamburger global flotante (solo mobile), fallback para
          páginas V1 que no montan su propio MobileAppHeader. Issue #161:
          cuando una página SÍ lo monta, el FAB se oculta (ownHeaderCount > 0)
          para no encimarse con el ☰ 44×44 ya integrado ahí. */}
      {isMobile && ownHeaderCount === 0 && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Abrir menú"
          className="fixed top-3 left-3 z-40 w-11 h-11 rounded-lg inline-flex items-center justify-center bg-[var(--color-surf-card)]/95 backdrop-blur border border-[var(--color-border-strong)] text-tech-white shadow-lg hover:bg-[var(--color-surf-hover)] transition-colors"
        >
          <Menu size={18} />
        </button>
      )}

      <div className={isMobile ? 'contents' : 'flex-1 flex flex-col min-w-0 lg:ml-64'}>
        <main
          className={
            isMobile
              ? 'flex-1 overflow-y-auto overflow-x-hidden pb-20 pt-2 px-3'
              : 'flex-1 overflow-y-auto overflow-x-hidden'
          }
        >
          <div
            className={isMobile ? 'contents' : 'p-4 md:p-6 xl:p-8 w-full min-h-full'}
            style={isMobile ? undefined : { animation: 'fadeInUp 0.3s ease-out both' }}
          >
            {!isMobile && <Breadcrumb />}
            <Suspense fallback={<PageFallback />}>
              <Outlet context={outletContext} />
            </Suspense>
          </div>
        </main>

        {/* Footer desktop-only. */}
        {!isMobile && (
          <footer className="bg-surf-sidebar border-t border-border py-2 px-6 text-center shrink-0">
            <p className="text-gunmetal text-xs">Collector's Forge Studio · Medellín, Colombia</p>
          </footer>
        )}
      </div>

      {/* Bottom nav mobile-only (reemplaza sidebar + hamburger en táctil). */}
      {isMobile && <MobileBottomNav />}
      {/* Fix #168: el modal de atajos de teclado (#140) es desktop-only — no
          hay teclado físico en mobile para dispararlo. */}
      {!isMobile && helpOpen && <KeyboardShortcutsModal onClose={closeHelp} />}
    </div>
  );
}
