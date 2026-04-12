/**
 * @file Layout de la aplicación Mantenimiento dentro de Collector's Forge Studio.
 * @module components/MaintenanceLayout
 */

import { LayoutDashboard, ClipboardList, Printer } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/maintenance/dashboard', icon: LayoutDashboard, label: 'Estado general' },
  { to: '/maintenance/logs',      icon: ClipboardList,   label: 'Historial'      },
  { to: '/maintenance/printers',  icon: Printer,         label: 'Impresoras'     },
];

/** @returns {JSX.Element} */
export default function MaintenanceLayout() {
  return (
    <AppLayout
      appName="Mantenimiento"
      navItems={navItems}
      activeClass="bg-violet-500/10 text-violet-400"
    />
  );
}
