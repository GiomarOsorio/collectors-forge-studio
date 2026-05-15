/**
 * @file Definición centralizada de las aplicaciones de Collector's Forge Studio.
 *
 * Fuente única de verdad para nombres, rutas, íconos y colores de cada app.
 * Importar desde aquí en lugar de duplicar el array en cada componente.
 *
 * @module config/apps
 */

import { Archive, Building2, Calculator, Package, Cpu, Wrench, ListOrdered } from 'lucide-react';

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
    shortDescription: 'Cotizaciones y calculadora de costos',
    description: 'Cotizaciones de cliente, calculadora de costos reales (material, electricidad, mantenimiento, mano de obra, margen).',
    icon: Calculator,
    route: '/cost/v2',
    color: '#2DD4BF',
    badge: null,
  },
  {
    id: 'inventory',
    name: 'Inventario',
    shortDescription: 'Stock, alertas y seguimiento de compras',
    description: 'Gestión de stock con vista nueva (KPIs + grid + drawer), alertas de mínimos y seguimiento de compras.',
    icon: Package,
    route: '/inventory/v2',
    color: '#3B82F6',
    badge: null,
  },
  {
    id: 'slicer',
    name: 'Slicer',
    shortDescription: 'Laminar modelos y calcular tiempos',
    description: 'Lamina modelos STL con OrcaSlicer o sube archivos .gcode/.3mf. Histórico con badges de status y "usar en calculadora".',
    icon: Cpu,
    route: '/slicer/v2',
    color: '#F59E0B',
    badge: null,
  },
  {
    id: 'maintenance',
    name: 'Mantenimiento',
    shortDescription: 'Mantenimiento de impresoras',
    description: 'Dashboard con badges 🟢🟡🔴 por tipo de mantenimiento. Historial de logs y wiki BambuLab.',
    icon: Wrench,
    route: '/maintenance/v2',
    color: '#8B5CF6',
    badge: null,
  },
  {
    id: 'queue',
    name: 'Queue',
    shortDescription: 'Cola de impresión',
    description: 'Cola de trabajos de impresión. Marca como impreso para descontar inventario y actualizar horas de impresora.',
    icon: ListOrdered,
    route: '/queue/v2',
    color: '#14B8A6',
    badge: null,
  },
  {
    id: 'vault',
    name: 'Vault',
    shortDescription: 'Archivo de modelos .3mf',
    description: 'Galería de modelos .3mf con thumbnails extraídos del propio archivo (no del logo BambuLab).',
    icon: Archive,
    route: '/vault',
    color: '#F43F5E',
    badge: null,
  },
  {
    id: 'company',
    name: 'Compañía',
    shortDescription: 'Perfil, marca y templates PDF',
    description: 'Configura el perfil de empresa, la paleta de colores del PDF y los templates Liquid personalizados.',
    icon: Building2,
    route: '/company/v2',
    color: '#6366F1',
    badge: null,
  },
];
