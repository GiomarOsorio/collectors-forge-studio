/**
 * @file Header in-page mobile compartido entre todas las apps v2.
 *
 * Replica el patrón `inventory-mobile.jsx::MobileHeader` del design Claude:
 *  - Hamburger button (izq) abre la sidebar mobile vía `onMenu`
 *  - Badge accent + eyebrow con nombre del app
 *  - Título grande dinámico (nombre del tab/sección actual)
 *  - Search button (der, opcional) dispara `onSearch`
 *  - Bell button (der) con dot amber de notificaciones
 *
 * Para que el menu hamburger funcione, el page debe leer `openSidebar` de
 * `useOutletContext()` (provisto por `AppLayout`) y pasarlo como `onMenu`.
 *
 * Issue #161 (P7): se auto-registra en `AppLayout` vía `useOutletContext()`
 * al montar para que el FAB hamburger global se oculte mientras este header
 * está en pantalla — evita la colisión visual entre ambos (ver
 * `agent-docs/ui-responsive/mockups/patterns.html` sección P7). Las páginas
 * V1 que no montan este componente siguen viendo el FAB como fallback.
 *
 * @module components/MobileAppHeader
 */

import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Bell, Menu, Search } from 'lucide-react';

const ICON_BTN =
  'w-11 h-11 rounded-lg border border-[var(--color-border)] inline-flex items-center justify-center text-tech-white bg-transparent shrink-0 active:bg-[var(--color-surf-hover)] transition-colors';

/**
 * @param {Object} props
 * @param {string}                props.appName        - Eyebrow del app (ej. "Inventario").
 * @param {React.ComponentType}   props.appIcon        - Ícono lucide del app (Box, Calculator, etc.).
 * @param {string}                props.appAccent      - Color hex del app (ej. "#3B82F6").
 * @param {string}                props.title          - Título grande dinámico (tab/sección).
 * @param {() => void}            props.onMenu         - Abre la sidebar mobile.
 * @param {(() => void)} [props.onSearch]              - Si se provee, muestra search button.
 * @param {boolean}    [props.showNotificationDot=true] - Dot amber sobre el ícono bell.
 */
export default function MobileAppHeader({
  appName,
  appIcon: AppIcon,
  appAccent,
  title,
  onMenu,
  onSearch,
  showNotificationDot = true,
}) {
  // `useOutletContext` no lanza si se usa fuera de un <Route> (retorna el
  // default del contexto, undefined) — seguro para tests que renderizan
  // este componente aislado.
  const outletContext = useOutletContext();
  useEffect(() => {
    outletContext?.registerMobileHeader?.(true);
    return () => outletContext?.registerMobileHeader?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-4 pt-1 pb-2.5 flex items-center gap-2.5">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menú"
        className={ICON_BTN}
      >
        <Menu size={19} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {AppIcon && (
            <span
              className="inline-flex items-center justify-center w-[18px] h-[18px] rounded shrink-0"
              style={{
                background: `color-mix(in oklab, ${appAccent} 14%, transparent)`,
                color: appAccent,
              }}
            >
              <AppIcon size={10} />
            </span>
          )}
          {appName && (
            <span className="text-[11px] text-gunmetal tracking-wide truncate">
              {appName}
            </span>
          )}
        </div>
        <h1 className="text-[18px] font-semibold text-tech-white tracking-tight leading-tight mt-px capitalize truncate">
          {title}
        </h1>
      </div>
      {onSearch && (
        <button
          type="button"
          onClick={onSearch}
          aria-label="Buscar"
          className={ICON_BTN}
        >
          <Search size={17} />
        </button>
      )}
      <button
        type="button"
        aria-label="Notificaciones"
        className={`${ICON_BTN} relative`}
      >
        <Bell size={17} />
        {showNotificationDot && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 w-[7px] h-[7px] rounded-full bg-amber-400"
            style={{ boxShadow: '0 0 0 2px var(--color-forge-black)' }}
          />
        )}
      </button>
    </div>
  );
}
