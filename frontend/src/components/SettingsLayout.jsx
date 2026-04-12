/**
 * @file Layout de la aplicación Configuración dentro de Collector's Forge Studio.
 *
 * App separada sin tarjeta en el dashboard. Se accede desde el nombre de usuario
 * en cualquier otra app. El logo lleva de vuelta a Collector's Forge Studio (/),
 * sin AppSwitcherDrawer.
 *
 * @module components/SettingsLayout
 */

import { User, Building2, Users } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/settings/account', icon: User,      label: 'Cuenta'   },
  { to: '/settings/company', icon: Building2, label: 'Empresa'  },
  { to: '/settings/users',   icon: Users,     label: 'Usuarios' },
];

/** @returns {JSX.Element} */
export default function SettingsLayout() {
  return (
    <AppLayout
      appName="Configuración"
      navItems={navItems}
      activeClass="bg-forge-teal/10 text-forge-teal"
      useAppSwitcher={false}
    />
  );
}
