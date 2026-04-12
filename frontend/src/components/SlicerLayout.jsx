/**
 * @file Layout de la aplicación Slicer dentro de Collector's Forge Studio.
 * @module components/SlicerLayout
 */

import { Upload, History } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/slicer/upload',  icon: Upload,  label: 'Subir modelo' },
  { to: '/slicer/history', icon: History, label: 'Historial'    },
];

/** @returns {JSX.Element} */
export default function SlicerLayout() {
  return (
    <AppLayout
      appName="Slicer"
      navItems={navItems}
      activeClass="bg-amber-400/10 text-amber-400"
    />
  );
}
