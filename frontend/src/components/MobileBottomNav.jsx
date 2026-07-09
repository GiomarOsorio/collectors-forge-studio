/**
 * @file Bottom navigation para mobile (≤ Tailwind `lg`).
 *
 * Reemplaza la sidebar y el hamburger en pantallas táctiles. Muestra 5
 * apps principales como íconos verticales con label + badges en vivo
 * desde `useBadges` (cola pendiente, mantenimiento vencido).
 *
 * Inspirado en `claude design/inventory-mobile.jsx::BottomNav`.
 *
 * @module components/MobileBottomNav
 */

import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calculator, ListOrdered, Package, Wrench } from 'lucide-react';
import { useBadges } from '../hooks/useBadges';

/** Apps fijas que aparecen en la bottom nav (4 slots). */
const ITEMS = [
  { id: 'cost',        label: 'Costos',     icon: Calculator,  to: '/cost',         match: '/cost' },
  { id: 'inventory',   label: 'Inventario', icon: Package,     to: '/inventory',    match: '/inventory' },
  { id: 'queue',       label: 'Cola',       icon: ListOrdered, to: '/queue',        match: '/queue',       badgeKey: 'pendingQueue' },
  { id: 'maintenance', label: 'Mantto',     icon: Wrench,      to: '/maintenance',  match: '/maintenance', badgeKey: 'overdueMaintenance', badgeWarn: true },
];

/**
 * @returns {JSX.Element}
 */
export default function MobileBottomNav() {
  const { pathname } = useLocation();
  const badges = useBadges();

  const activeId = useMemo(() => {
    const found = ITEMS.find((it) => pathname.startsWith(it.match));
    return found?.id;
  }, [pathname]);

  return (
    <nav
      className="fixed left-0 right-0 bottom-0 z-30 flex justify-around items-stretch lg:hidden"
      style={{
        background: 'rgba(10, 14, 22, 0.92)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: 8,
        paddingBottom: 'max(env(safe-area-inset-bottom), 12px)',
      }}
      aria-label="Navegación principal"
    >
      {ITEMS.map((it) => {
        const Icon = it.icon;
        const active = it.id === activeId;
        const count = it.badgeKey ? badges[it.badgeKey] || 0 : 0;
        return (
          <Link
            key={it.id}
            to={it.to}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1 transition-colors"
            style={{ color: active ? 'var(--color-app-inventory)' : 'var(--color-gunmetal)' }}
            aria-current={active ? 'page' : undefined}
          >
            <span className="relative inline-flex">
              <Icon size={19} strokeWidth={active ? 2.2 : 1.8} />
              {count > 0 && (
                <span
                  className="mono absolute -top-1.5 -right-2 text-[8.5px] font-semibold px-1 rounded-full min-w-[14px] text-center leading-tight"
                  style={{
                    background: it.badgeWarn ? 'var(--color-forge-amber)' : 'var(--color-app-inventory)',
                    color: '#0A1014',
                    border: '1.5px solid var(--color-surf-sidebar)',
                    paddingTop: 1,
                    paddingBottom: 1,
                  }}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </span>
            <span className="text-[9.5px] font-medium tracking-wide">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
