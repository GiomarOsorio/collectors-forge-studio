/**
 * @file Layout de la aplicación Inventario (Archive) dentro de TurtleForge Studio.
 * @module components/InventoryLayout
 */

import { PackageOpen, ShoppingCart, Layers, Package, Printer, ArrowLeftRight, Wrench, Tags } from 'lucide-react';
import AppLayout from './AppLayout';

const navItems = [
  { to: '/inventory/filaments',  icon: Layers,         label: 'Filamentos'           },
  { to: '/inventory/supplies',   icon: Package,        label: 'Insumos'              },
  { to: '/inventory/tools',      icon: Wrench,         label: 'Herramientas'         },
  { to: '/inventory/stock',      icon: PackageOpen,    label: 'Todo el stock'        },
  { to: '/inventory/purchases',  icon: ShoppingCart,   label: 'Pedidos'              },
  { to: '/inventory/prints',     icon: Printer,        label: 'Disponible para Venta' },
  { to: '/inventory/io',         icon: ArrowLeftRight, label: 'Importar / Exportar'  },
  { to: '/inventory/categories', icon: Tags,           label: 'Categorías'           },
];

/** @returns {JSX.Element} */
export default function InventoryLayout() {
  return (
    <AppLayout
      appName="Archive"
      navItems={navItems}
      activeClass="bg-blue-500/10 text-blue-400"
    />
  );
}
