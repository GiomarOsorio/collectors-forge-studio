/**
 * @file Layout de la aplicación Compañía dentro de TurtleForge Studio.
 * @module components/CompanyLayout
 */

import { Building2, Palette, FileCode } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/company/profile',   icon: Building2, label: 'Perfil'          },
  { to: '/company/branding',  icon: Palette,   label: 'Marca & Colores' },
  { to: '/company/templates', icon: FileCode,  label: 'Templates PDF'   },
];

/** @returns {JSX.Element} */
export default function CompanyLayout() {
  return (
    <AppLayout
      appName="Compañía"
      navItems={navItems}
      activeClass="bg-indigo-500/10 text-indigo-400"
    />
  );
}
