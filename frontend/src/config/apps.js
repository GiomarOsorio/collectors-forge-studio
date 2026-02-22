/**
 * @file Definición centralizada de las aplicaciones de TurtleForge Studio.
 *
 * Fuente única de verdad para nombres, rutas, íconos y colores de cada app.
 * Importar desde aquí en lugar de duplicar el array en cada componente.
 *
 * @module config/apps
 */

import { Calculator, Package, Cpu } from 'lucide-react';

/**
 * @typedef {Object} AppDefinition
 * @property {string}              id               - Identificador único de la app
 * @property {string}              name             - Nombre mostrado en la UI
 * @property {string}              shortDescription - Descripción corta (AppSwitcherDrawer)
 * @property {string}              description      - Descripción completa (StudioHomePage)
 * @property {React.ComponentType} icon             - Ícono de Lucide React
 * @property {string}              route            - Ruta de entrada de la app
 * @property {string}              color            - Color identificador en hex
 * @property {string|null}         badge            - Badge opcional (p. ej. "Nuevo")
 */

/** @type {AppDefinition[]} */
export const APPS = [
  {
    id: 'cost',
    name: 'Cost',
    shortDescription: 'Calculadora de costos de impresión 3D',
    description: 'Calculadora de costos de impresión 3D. Gestiona filamentos, impresoras, insumos y genera cotizaciones.',
    icon: Calculator,
    route: '/cost/calculator',
    color: '#3FAF4C',
    badge: null,
  },
  {
    id: 'inventory',
    name: 'Archive',
    shortDescription: 'Stock, alertas y seguimiento de compras',
    description: 'Gestión de stock, alertas de mínimos y seguimiento de compras con tracking internacional.',
    icon: Package,
    route: '/inventory/stock',
    color: '#3B82F6',
    badge: null,
  },
  {
    id: 'slicer',
    name: 'Slicer',
    shortDescription: 'Laminar modelos y calcular tiempos',
    description: 'Lamina modelos STL con OrcaSlicer o sube archivos .gcode/.3mf para extraer datos de impresión.',
    icon: Cpu,
    route: '/slicer/upload',
    color: '#F59E0B',
    badge: null,
  },
];
