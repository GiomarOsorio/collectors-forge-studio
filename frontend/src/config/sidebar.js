/**
 * @file Configuración central de la sidebar unificada de Collector's Forge Studio.
 *
 * Define las apps que aparecen en la sidebar, su ícono, color, items internos
 * y la clase de tailwind para el item activo. Una estructura única consultada
 * desde StudioSidebar.
 *
 * @module config/sidebar
 */

import {
  Archive,
  ArrowLeftRight,
  Building2,
  Calculator,
  Clock,
  Cpu,
  FileEdit,
  FileText,
  Layers,
  LayoutDashboard,
  ListOrdered,
  Package,
  Printer,
  Settings,
  ShoppingCart,
  Upload,
  Wrench,
} from 'lucide-react';

/**
 * @typedef {Object} SidebarItem
 * @property {string}              to        - Ruta de destino
 * @property {React.ComponentType} icon      - Ícono Lucide
 * @property {string}              label     - Texto del enlace
 * @property {boolean}             [end]     - NavLink end (match exacto)
 * @property {boolean}             [adminOnly] - Solo visible para admin
 */

/**
 * @typedef {Object} SidebarApp
 * @property {string}              id          - Identificador (= APPS.id de config/apps.js)
 * @property {string}              name        - Nombre mostrado
 * @property {React.ComponentType} icon        - Ícono principal
 * @property {string}              color       - Color hex
 * @property {string}              activeClass - Clases Tailwind para item activo
 * @property {string}              [badgeKey]  - Nombre de badge (pendingQueue|lowStock|overdueMaintenance)
 * @property {boolean}             [adminOnly] - App completa solo visible a admin
 * @property {SidebarItem[]}       items       - Items internos
 */

/** @type {SidebarApp[]} */
export const SIDEBAR_APPS = [
  {
    id: 'cost',
    name: 'Cost',
    icon: Calculator,
    color: '#2DD4BF',
    activeClass: 'bg-forge-teal/15 text-forge-teal',
    items: [
      { to: '/cost',             icon: FileText,   label: 'Cotizaciones', end: true },
      { to: '/cost/calculator',  icon: Calculator, label: 'Calcular pieza' },
      { to: '/cost/manual',      icon: FileEdit,   label: 'Nueva cotización' },
      { to: '/cost/printers',    icon: Printer,    label: 'Impresoras' },
      { to: '/cost/settings',    icon: Settings,   label: 'Tarifa & ajustes' },
    ],
  },
  {
    id: 'inventory',
    name: 'Inventario',
    icon: Package,
    color: '#3B82F6',
    activeClass: 'bg-blue-500/15 text-blue-400',
    badgeKey: 'lowStock',
    items: [
      { to: '/inventory',           icon: Layers,         label: 'Resumen', end: true },
      { to: '/inventory/purchases', icon: ShoppingCart,   label: 'Pedidos' },
      { to: '/inventory/prints',    icon: Printer,        label: 'Disponible para venta' },
      { to: '/inventory/io',        icon: ArrowLeftRight, label: 'Importar / Exportar' },
    ],
  },
  {
    id: 'slicer',
    name: 'Slicer',
    icon: Cpu,
    color: '#F59E0B',
    activeClass: 'bg-amber-400/15 text-amber-400',
    items: [
      { to: '/slicer', icon: Layers, label: 'Slicer', end: true },
    ],
  },
  {
    id: 'maintenance',
    name: 'Mantenimiento',
    icon: Wrench,
    color: '#8B5CF6',
    activeClass: 'bg-violet-500/15 text-violet-400',
    badgeKey: 'overdueMaintenance',
    items: [
      { to: '/maintenance', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    id: 'queue',
    name: 'Queue',
    icon: ListOrdered,
    color: '#14B8A6',
    activeClass: 'bg-teal-500/15 text-teal-400',
    badgeKey: 'pendingQueue',
    items: [
      { to: '/queue', icon: ListOrdered, label: 'Cola', end: true },
    ],
  },
  {
    id: 'vault',
    name: 'Vault',
    icon: Archive,
    color: '#F43F5E',
    activeClass: 'bg-rose-500/15 text-rose-400',
    items: [
      { to: '/vault',        icon: Archive, label: 'Galería', end: true },
      { to: '/vault/upload', icon: Upload,  label: 'Subir modelo', adminOnly: true },
    ],
  },
  {
    id: 'company',
    name: 'Compañía',
    icon: Building2,
    color: '#6366F1',
    activeClass: 'bg-indigo-500/15 text-indigo-400',
    adminOnly: true,
    items: [
      { to: '/company', icon: Building2, label: 'Resumen', end: true },
    ],
  },
];

/**
 * App de Configuración, separada del array principal porque no aparece como
 * tarjeta en el dashboard. Se accede desde el nombre de usuario en el footer.
 *
 * @type {SidebarApp}
 */
export const SETTINGS_APP = {
  id: 'settings',
  name: 'Configuración',
  icon: Settings,
  color: '#2DD4BF',
  activeClass: 'bg-forge-teal/15 text-forge-teal',
  items: [
    { to: '/settings', icon: Settings, label: 'Configuración', end: true },
  ],
};

/**
 * Devuelve la app de la sidebar que coincide con el pathname actual.
 *
 * @param {string} pathname - Ruta activa (location.pathname).
 * @returns {SidebarApp|null}
 */
export function getActiveApp(pathname) {
  if (pathname.startsWith('/settings')) return SETTINGS_APP;
  for (const app of SIDEBAR_APPS) {
    if (pathname.startsWith(`/${app.id}`)) return app;
  }
  // Caso especial: /inventory/* → id 'inventory'
  return null;
}
