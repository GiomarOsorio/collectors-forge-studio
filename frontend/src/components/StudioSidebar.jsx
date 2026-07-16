/**
 * @file Sidebar unificada de Collector's Forge Studio (port Claude Design v2).
 *
 * Replica el `sidebar.jsx` del design Claude:
 *  - Brand header (logo + título)
 *  - Search visual (⌘K placeholder)
 *  - APPS section: lista FLAT (sin dropdown por app) con drag&drop para
 *    reordenar. Click en el app navega a su ruta principal.
 *  - Footer: avatar + username + rol·ciudad + gear ⚙️ (Settings) + LogOut
 *
 * Decisión 2026-07-16 (issue #181): la sidebar es SOLO apps — la sección
 * secundaria por app (subnav) se eliminó. El segundo nivel de cada app
 * (rutas internas) vive ahora como `AppTabs` arriba del contenido de cada
 * página; ver `SIDEBAR_APPS[].items` en `config/sidebar.js`, que sigue
 * siendo la fuente de verdad de esas rutas para quien monte los tabs.
 *
 * @module components/StudioSidebar
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, LogOut, Search, Settings, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../hooks/useBadges';
import { SETTINGS_APP, SIDEBAR_APPS, getActiveApp } from '../config/sidebar';

const ORDER_STORAGE_KEY = 'cfs.sidebar.order';

/**
 * Resuelve la ruta principal de un app (primer item del array).
 *
 * @param {{ items: Array<{ to: string }> }} app
 * @returns {string}
 */
function appHomeRoute(app) {
  return app?.items?.[0]?.to || `/${app?.id || ''}`;
}

/**
 * Badge numérico mono compacto al lado del label de un app.
 *
 * @param {{ count: number, tone?: 'warn'|'info' }} props
 */
function AppBadge({ count, tone = 'warn' }) {
  if (!count) return null;
  const palette =
    tone === 'warn'
      ? { bg: 'rgba(251, 191, 36, 0.14)', fg: '#FBBF24', border: 'rgba(251, 191, 36, 0.25)' }
      : { bg: 'rgba(45, 212, 191, 0.14)', fg: '#2DD4BF', border: 'rgba(45, 212, 191, 0.25)' };
  return (
    <span
      className="mono text-[10px] font-semibold px-1.5 rounded-full border whitespace-nowrap shrink-0"
      style={{ background: palette.bg, color: palette.fg, borderColor: palette.border }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Fila de app (flat, draggable). Click navega a la ruta principal del app.
 * Aplica accent left-bar cuando está activo.
 */
function AppRow({ app, active, badgeCount, dragHandle, onNavigate }) {
  const Icon = app.icon;
  return (
    <div className="group flex items-center gap-0.5">
      {dragHandle && (
        <button
          {...dragHandle}
          type="button"
          className="p-1 text-gunmetal-dim opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing shrink-0"
          aria-label={`Reordenar ${app.name}`}
          title="Arrastrar para reordenar"
        >
          <GripVertical size={14} />
        </button>
      )}
      <NavLink
        to={appHomeRoute(app)}
        onClick={onNavigate}
        className={`relative flex-1 flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors border ${
          active
            ? 'bg-blue-500/8 border-blue-500/22 text-tech-white'
            : 'bg-transparent border-transparent text-steel hover:bg-surf-hover hover:text-tech-white'
        }`}
        style={
          active
            ? { background: `color-mix(in oklab, ${app.color} 8%, transparent)`, borderColor: `color-mix(in oklab, ${app.color} 22%, transparent)` }
            : undefined
        }
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute -left-px top-1.5 bottom-1.5 w-0.5 rounded-sm"
            style={{ background: app.color }}
          />
        )}
        <Icon size={16} style={{ color: app.color }} className="shrink-0" />
        <span className="flex-1 truncate text-left">{app.name}</span>
        <AppBadge count={badgeCount} tone={app.badgeKey === 'pendingQueue' ? 'info' : 'warn'} />
      </NavLink>
    </div>
  );
}

/**
 * Wrapper sortable @dnd-kit.
 */
function SortableAppRow({ id, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <li ref={setNodeRef} style={style} {...attributes}>
      {children({ ...listeners })}
    </li>
  );
}

/**
 * Lee y normaliza el orden de apps guardado en localStorage.
 */
function loadOrder(validIds) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((id) => validIds.has(id));
        for (const id of validIds) if (!filtered.includes(id)) filtered.push(id);
        return filtered;
      }
    }
  } catch {
    /* fallback */
  }
  return Array.from(validIds);
}

/**
 * Sidebar global de Collector's Forge Studio (rediseñada Claude Design v2).
 *
 * @param {{ open: boolean, onClose: () => void }} props
 *   open  — visibilidad del drawer en mobile (xl:siempre visible).
 *   onClose — callback al navegar/cerrar drawer en mobile.
 * @returns {JSX.Element}
 */
export default function StudioSidebar({ open, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const badges = useBadges();
  const isAdmin = user?.role === 'admin';

  const visibleApps = useMemo(
    () => SIDEBAR_APPS.filter((a) => !a.adminOnly || isAdmin),
    [isAdmin],
  );
  const validIds = useMemo(() => new Set(visibleApps.map((a) => a.id)), [visibleApps]);

  const [order, setOrder] = useState(() => loadOrder(validIds));

  // Resync orden si cambia el set de apps visibles (login admin/operator).
  useEffect(() => {
    setOrder((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      for (const id of validIds) if (!filtered.includes(id)) filtered.push(id);
      return filtered;
    });
  }, [validIds]);

  useEffect(() => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  }, [order]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)));
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const orderedApps = order
    .map((id) => visibleApps.find((a) => a.id === id))
    .filter(Boolean);

  // App activa = primer app cuya ruta hace match con location.pathname.
  // Settings se trata como app secundaria solo si estamos en /settings/*.
  const activeApp = useMemo(() => {
    const fromHelper = getActiveApp(location.pathname);
    if (fromHelper) return fromHelper;
    return null;
  }, [location.pathname]);

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-surf-sidebar text-tech-white border-r border-border-soft flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Brand */}
        <div className="px-3.5 py-3.5 border-b border-border-soft flex items-center justify-between gap-2">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-2.5 min-w-0 hover:opacity-90 transition-opacity group flex-1"
          >
            <img
              src="/logo.png"
              alt="Collector's Forge"
              className="h-7 w-7 object-contain shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-tech-white truncate">
                Collector's Forge
              </span>
              <span className="mono text-[10px] text-gunmetal-dim tracking-wider">
                STUDIO · v0.4
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gunmetal hover:text-tech-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search (visual, ⌘K placeholder) */}
        <div className="px-3 py-2.5">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-gunmetal-dim"
            style={{ background: 'var(--color-forge-black)', borderColor: 'var(--color-border-soft)' }}
          >
            <Search size={13} />
            <span className="flex-1 text-xs">Buscar…</span>
            <span
              className="mono text-[10px] px-1 rounded-sm border"
              style={{ borderColor: 'var(--color-border-soft)' }}
            >
              ⌘K
            </span>
          </div>
        </div>

        {/* Apps + secondary (active app items) */}
        <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-2">
          {/* APPS eyebrow */}
          <div className="px-2 pb-1.5 flex items-center gap-1.5">
            <span
              className="lbl-eyebrow text-[10px] tracking-widest"
              style={{ color: 'var(--color-gunmetal-dim)' }}
            >
              Apps
            </span>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-0.5">
                {orderedApps.map((app) => (
                  <SortableAppRow key={app.id} id={app.id}>
                    {(handleProps) => (
                      <AppRow
                        app={app}
                        active={activeApp?.id === app.id}
                        badgeCount={app.badgeKey ? badges[app.badgeKey] || 0 : 0}
                        dragHandle={handleProps}
                        onNavigate={onClose}
                      />
                    )}
                  </SortableAppRow>
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </nav>

        {/* Footer: avatar + user + Settings ⚙️ + Logout */}
        <div className="px-3 py-2.5 border-t border-border-soft flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-tech-white shrink-0 border"
            style={{ background: 'var(--color-surf-hover)', borderColor: 'var(--color-border-strong)', fontFamily: 'var(--font-mono)' }}
          >
            {(user?.username || '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0 leading-tight">
            <NavLink
              to="/settings/account"
              onClick={onClose}
              className="text-[12px] font-medium text-tech-white truncate hover:text-forge-teal transition-colors block"
              title={`${user?.username} (${user?.role || '—'})`}
            >
              {user?.username || '—'}
            </NavLink>
            <span className="mono text-[10px] text-gunmetal-dim tracking-wide truncate block">
              {user?.role || '—'}
            </span>
          </div>
          <NavLink
            to="/settings/account"
            onClick={onClose}
            aria-label="Configuración"
            title="Configuración"
            className="p-1.5 text-gunmetal hover:text-tech-white rounded-md hover:bg-surf-hover transition-colors shrink-0"
          >
            <Settings size={14} />
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="p-1.5 text-gunmetal hover:text-tech-white rounded-md hover:bg-surf-hover transition-colors shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}

// SETTINGS_APP queda exportado en config/sidebar.js para Breadcrumb y otros
// consumidores. Aquí ya no se renderiza como sección — se accede vía el
// gear ⚙️ del footer.
export { SETTINGS_APP };
