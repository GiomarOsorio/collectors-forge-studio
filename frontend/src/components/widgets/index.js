/**
 * @file Registro de widgets del dashboard de Collector's Forge Studio.
 *
 * Cada widget aporta: `id`, `title`, `icon`, `color`, `Component`, `defaultVisible`
 * y `defaultSize`. El `Dashboard` consume este registro para renderizar la grilla
 * y para reconciliar el layout persistido cuando aparecen nuevos widgets.
 *
 * @module components/widgets
 */

import { FileText, ListOrdered, PackageOpen, Wrench } from 'lucide-react';
import QueueWidget from './QueueWidget';
import LowStockWidget from './LowStockWidget';
import QuotesWidget from './QuotesWidget';
import MaintenanceWidget from './MaintenanceWidget';

/**
 * @typedef {('quarter'|'half'|'full')} WidgetSize
 *
 * - quarter: 3 cols (4 widgets por fila en xl)
 * - half:    6 cols (2 widgets por fila en xl)
 * - full:    12 cols (ocupa todo el ancho)
 */

/**
 * @typedef {Object} WidgetDef
 * @property {string}              id              - Id único persistido en localStorage
 * @property {string}              title           - Título mostrado en la cabecera
 * @property {React.ComponentType} icon            - Ícono Lucide al lado del título
 * @property {string}              color           - Color hex para el ícono
 * @property {React.ComponentType} Component       - Componente que renderiza el body
 * @property {boolean}             defaultVisible  - Visible por defecto en nuevos layouts
 * @property {WidgetSize}          defaultSize     - Tamaño inicial
 */

/** @type {WidgetDef[]} */
export const WIDGETS = [
  {
    id: 'queue',
    title: 'Cola activa',
    icon: ListOrdered,
    color: '#14B8A6',
    Component: QueueWidget,
    defaultVisible: true,
    defaultSize: 'half',
  },
  {
    id: 'lowStock',
    title: 'Stock bajo',
    icon: PackageOpen,
    color: '#3B82F6',
    Component: LowStockWidget,
    defaultVisible: true,
    defaultSize: 'half',
  },
  {
    id: 'quotes',
    title: 'Cotizaciones recientes',
    icon: FileText,
    color: '#2DD4BF',
    Component: QuotesWidget,
    defaultVisible: true,
    defaultSize: 'half',
  },
  {
    id: 'maintenance',
    title: 'Mantenimiento pendiente',
    icon: Wrench,
    color: '#8B5CF6',
    Component: MaintenanceWidget,
    defaultVisible: true,
    defaultSize: 'half',
  },
];

/** Mapa id → definición para lookups O(1) desde Dashboard. */
export const WIDGETS_BY_ID = WIDGETS.reduce((acc, w) => {
  acc[w.id] = w;
  return acc;
}, {});

/** Tamaños válidos para validar layouts persistidos. */
export const VALID_SIZES = ['quarter', 'half', 'full'];

/** Siguiente tamaño en el ciclo (click en botón resize). */
export const NEXT_SIZE = { quarter: 'half', half: 'full', full: 'quarter' };
