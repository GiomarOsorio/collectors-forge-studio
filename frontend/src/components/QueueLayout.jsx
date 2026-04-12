/**
 * @file Layout de la aplicación Queue dentro de Collector's Forge Studio.
 * @module components/QueueLayout
 */

import { ListOrdered, Clock } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/queue/',        icon: ListOrdered, label: 'Cola activa', end: true },
  { to: '/queue/history', icon: Clock,       label: 'Historial'             },
];

/** @returns {JSX.Element} */
export default function QueueLayout() {
  return (
    <AppLayout
      appName="Queue"
      navItems={navItems}
      activeClass="bg-teal-500/10 text-teal-400"
    />
  );
}
