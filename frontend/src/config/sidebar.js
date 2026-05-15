/**
 * @file Configuración central de la sidebar unificada de Collector's Forge Studio.
 *
 * Define las apps que aparecen en la sidebar, su ícono, color, items internos
 * y la clase de tailwind para el item activo. Reemplaza los 8 layouts por app
 * con una estructura única consultada desde StudioSidebar.
 *
 * @module config/sidebar
 */

import {
  Archive,
  ArrowLeftRight,
  Building2,
  Calculator,
  ClipboardList,
  Clock,
  Cpu,
  FileCode,
  FileEdit,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  ListOrdered,
  Package,
  PackageOpen,
  Palette,
  Printer,
  Settings,
  ShoppingCart,
  Upload,
  User,
  Users,
  Wrench,
  Zap,
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
      { to: '/cost/calculator', icon: Calculator, label: 'Calculadora' },
      { to: '/cost/quotes',     icon: FileText,   label: 'Cotizaciones' },
      { to: '/cost/manual',     icon: FileEdit,   label: 'Nueva Cotización' },
      { to: '/cost/printers',   icon: Printer,    label: 'Impresoras' },
      { to: '/cost/history',    icon: History,    label: 'Costos Impresión' },
      { to: '/cost/settings',   icon: Settings,   label: 'Configuración' },
    ],
  },
  {
    id: 'inventory',
    name: 'Archive',
    icon: Package,
    color: '#3B82F6',
    activeClass: 'bg-blue-500/15 text-blue-400',
    badgeKey: 'lowStock',
    items: [
      { to: '/inventory/filaments',   icon: Layers,         label: 'Filamentos' },
      { to: '/inventory/supplies',    icon: Package,        label: 'Insumos' },
      { to: '/inventory/tools',       icon: Wrench,         label: 'Herramientas' },
      { to: '/inventory/consumables', icon: Zap,            label: 'Consumibles' },
      { to: '/inventory/stock',       icon: PackageOpen,    label: 'Todo el stock' },
      { to: '/inventory/purchases',   icon: ShoppingCart,   label: 'Pedidos' },
      { to: '/inventory/prints',      icon: Printer,        label: 'Disponible para Venta' },
      { to: '/inventory/io',          icon: ArrowLeftRight, label: 'Importar / Exportar' },
    ],
  },
  {
    id: 'slicer',
    name: 'Slicer',
    icon: Cpu,
    color: '#F59E0B',
    activeClass: 'bg-amber-400/15 text-amber-400',
    items: [
      { to: '/slicer/upload',  icon: Upload,  label: 'Subir modelo' },
      { to: '/slicer/history', icon: History, label: 'Historial' },
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
      { to: '/maintenance/dashboard', icon: LayoutDashboard, label: 'Estado general' },
      { to: '/maintenance/logs',      icon: ClipboardList,   label: 'Historial' },
      { to: '/maintenance/printers',  icon: Printer,         label: 'Impresoras' },
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
      { to: '/queue/',        icon: ListOrdered, label: 'Cola activa', end: true },
      { to: '/queue/history', icon: Clock,       label: 'Historial' },
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
      { to: '/company/profile',   icon: Building2, label: 'Perfil' },
      { to: '/company/branding',  icon: Palette,   label: 'Marca & Colores' },
      { to: '/company/templates', icon: FileCode,  label: 'Templates PDF' },
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
    { to: '/settings/account', icon: User,      label: 'Cuenta' },
    { to: '/settings/company', icon: Building2, label: 'Empresa',  adminOnly: true },
    { to: '/settings/users',   icon: Users,     label: 'Usuarios', adminOnly: true },
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
