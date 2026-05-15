/**
 * @file Sidebar unificada de Collector's Forge Studio.
 *
 * Reemplaza los 8 layouts por app (CostLayout, InventoryLayout, etc.) con una
 * única sidebar global que muestra todas las apps como secciones colapsables,
 * con drag&drop para reordenar y badges en vivo para cola/stock/mantenimiento.
 *
 * Inspirado en `bambuddy/frontend/src/components/Layout.tsx` con la paleta
 * `forge-*` de CFS (sin `bambu-green`).
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
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBadges } from '../hooks/useBadges';
import { SETTINGS_APP, SIDEBAR_APPS, getActiveApp } from '../config/sidebar';

const ORDER_STORAGE_KEY = 'cfs.sidebar.order';
const EXPANDED_STORAGE_KEY = 'cfs.sidebar.expanded';

/**
 * Pinta un badge numérico circular en la esquina del ícono del app.
 *
 * @param {{ count: number }} props
 * @returns {JSX.Element|null}
 */
function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-rose-500 text-white border-2 border-[#0A0E16]">
      {count > 99 ? '99+' : count}
    </span>
  );
}

/**
 * Subitems del app (rutas internas tipo /cost/calculator).
 *
 * @param {{ items: Array, isAdmin: boolean, onNavigate: () => void, activeClass: string }} props
 * @returns {JSX.Element}
 */
function AppItems({ items, isAdmin, onNavigate, activeClass }) {
  return (
    <ul className="ml-7 mt-1 mb-2 space-y-0.5 border-l border-[#222630] pl-3">
      {items
        .filter((item) => !item.adminOnly || isAdmin)
        .map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    isActive
                      ? `${activeClass} font-medium`
                      : 'text-steel hover:bg-[#222630] hover:text-tech-white'
                  }`
                }
              >
                <Icon size={15} className="shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            </li>
          );
        })}
    </ul>
  );
}

/**
 * Cabecera + items de una app dentro de la sidebar.
 *
 * @param {{ app: any, expanded: boolean, onToggle: () => void, badgeCount: number, isAdmin: boolean, onNavigate: () => void, dragHandle?: object }} props
 * @returns {JSX.Element}
 */
function AppSection({ app, expanded, onToggle, badgeCount, isAdmin, onNavigate, dragHandle }) {
  const Icon = app.icon;
  return (
    <div className="group">
      <div className="flex items-center gap-0.5">
        {dragHandle && (
          <button
            {...dragHandle}
            type="button"
            className="p-1 text-gunmetal opacity-0 group-hover:opacity-60 hover:opacity-100 cursor-grab active:cursor-grabbing"
            aria-label={`Reordenar ${app.name}`}
            title="Arrastrar para reordenar"
          >
            <GripVertical size={14} />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#222630] transition-colors text-left"
          aria-expanded={expanded}
        >
          <div className="relative shrink-0">
            <Icon size={20} style={{ color: app.color }} />
            <Badge count={badgeCount} />
          </div>
          <span className="flex-1 text-sm font-medium text-tech-white truncate">{app.name}</span>
          {expanded ? (
            <ChevronDown size={16} className="text-gunmetal shrink-0" />
          ) : (
            <ChevronRight size={16} className="text-gunmetal shrink-0" />
          )}
        </button>
      </div>
      {expanded && (
        <AppItems
          items={app.items}
          isAdmin={isAdmin}
          onNavigate={onNavigate}
          activeClass={app.activeClass}
        />
      )}
    </div>
  );
}

/**
 * Wrapper sortable de @dnd-kit para una sección de app.
 *
 * @param {{ id: string, children: (handleProps: object) => React.ReactNode }} props
 * @returns {JSX.Element}
 */
function SortableSection({ id, children }) {
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
 * Lee y normaliza el orden guardado de las apps, asegurando que incluya todos
 * los `validIds` (ignorando obsoletos y agregando los nuevos al final).
 *
 * @param {Set<string>} validIds
 * @returns {string[]}
 */
function loadOrder(validIds) {
  try {
    const raw = localStorage.getItem(ORDER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((id) => validIds.has(id));
        for (const id of validIds) {
          if (!filtered.includes(id)) filtered.push(id);
        }
        return filtered;
      }
    }
  } catch {
    /* fallback debajo */
  }
  return Array.from(validIds);
}

/**
 * Lee el mapa de secciones expandidas (`{ [appId]: boolean }`).
 *
 * @returns {Record<string, boolean>}
 */
function loadExpanded() {
  try {
    const raw = localStorage.getItem(EXPANDED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    /* nada */
  }
  return {};
}

/**
 * Sidebar global de Collector's Forge Studio.
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
  const [expanded, setExpanded] = useState(() => loadExpanded());

  // Re-sincronizar orden si cambian las apps visibles (login admin/operator).
  useEffect(() => {
    setOrder((prev) => {
      const filtered = prev.filter((id) => validIds.has(id));
      for (const id of validIds) if (!filtered.includes(id)) filtered.push(id);
      return filtered;
    });
  }, [validIds]);

  // Persistir orden y secciones expandidas.
  useEffect(() => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
  }, [order]);
  useEffect(() => {
    localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify(expanded));
  }, [expanded]);

  // Auto-expandir la app activa.
  useEffect(() => {
    const active = getActiveApp(location.pathname);
    if (active && !expanded[active.id]) {
      setExpanded((prev) => ({ ...prev, [active.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)));
  };

  const toggle = (id) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const orderedApps = order
    .map((id) => visibleApps.find((a) => a.id === id))
    .filter(Boolean);

  const settingsExpanded = !!expanded[SETTINGS_APP.id];

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
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0A0E16] text-tech-white border-r border-[#222630] flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        {/* Header con logo */}
        <div className="px-4 py-4 border-b border-[#222630] flex items-center justify-between gap-2">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity group"
          >
            <img
              src="/logo.png"
              alt="Collector's Forge"
              className="h-9 w-9 object-contain shrink-0 group-hover:scale-105 transition-transform"
            />
            <div className="min-w-0">
              <p className="text-[10px] font-medium text-gunmetal leading-none uppercase tracking-widest">
                Collector's Forge
              </p>
              <h1 className="text-base font-bold text-tech-white leading-tight truncate">Studio</h1>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gunmetal hover:text-tech-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto p-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {orderedApps.map((app) => (
                  <SortableSection key={app.id} id={app.id}>
                    {(handleProps) => (
                      <AppSection
                        app={app}
                        expanded={!!expanded[app.id]}
                        onToggle={() => toggle(app.id)}
                        badgeCount={app.badgeKey ? badges[app.badgeKey] || 0 : 0}
                        isAdmin={isAdmin}
                        onNavigate={onClose}
                        dragHandle={handleProps}
                      />
                    )}
                  </SortableSection>
                ))}
              </ul>
            </SortableContext>
          </DndContext>

          {/* Settings — fija al final, sin drag */}
          <div className="mt-3 pt-3 border-t border-[#222630]">
            <AppSection
              app={SETTINGS_APP}
              expanded={settingsExpanded}
              onToggle={() => toggle(SETTINGS_APP.id)}
              badgeCount={0}
              isAdmin={isAdmin}
              onNavigate={onClose}
            />
          </div>
        </nav>

        {/* Footer: usuario + logout */}
        <div className="p-3 border-t border-[#222630] flex items-center justify-between gap-2">
          <NavLink
            to="/settings/account"
            onClick={onClose}
            className="text-gunmetal hover:text-tech-white text-sm transition-colors truncate"
            title="Mi cuenta"
          >
            {user?.username}
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            className="tf-btn-ghost shrink-0"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
