/**
 * @file Layout de la aplicación Cost dentro de Collector's Forge Studio.
 * @module components/CostLayout
 */

import { Calculator, FileEdit, FileText, Printer, History, Settings } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/cost/calculator', icon: Calculator, label: 'Calculadora'      },
  { to: '/cost/quotes',     icon: FileText,   label: 'Cotizaciones'     },
  { to: '/cost/manual',     icon: FileEdit,   label: 'Nueva Cotización' },
  { to: '/cost/printers',   icon: Printer,    label: 'Impresoras'       },
  { to: '/cost/history',    icon: History,    label: 'Costos Impresión' },
  { to: '/cost/settings',   icon: Settings,   label: 'Configuración'    },
];

/** @returns {JSX.Element} */
export default function CostLayout() {
  return (
    <AppLayout
      appName="Cost"
      navItems={navItems}
      activeClass="bg-forge-teal/10 text-forge-teal"
    />
  );
}
