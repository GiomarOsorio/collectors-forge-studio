/**
 * @file Layout de la aplicación Vault dentro de TurtleForge Studio.
 *
 * El ítem "Subir modelo" solo aparece en la navegación si el usuario
 * es administrador (is_admin=true). Los no-admins solo ven la galería.
 *
 * @module components/VaultLayout
 */

import { Archive, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AppLayout from './AppLayout';

/** @returns {JSX.Element} */
export default function VaultLayout() {
  const { user } = useAuth();

  const navItems = [
    { to: '/vault', icon: Archive, label: 'Galería', end: true },
    ...(user?.is_admin
      ? [{ to: '/vault/upload', icon: Upload, label: 'Subir modelo' }]
      : []),
  ];

  return (
    <AppLayout
      appName="Vault"
      navItems={navItems}
      activeClass="bg-rose-500/10 text-rose-400"
    />
  );
}
