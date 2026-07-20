/**
 * @file Breadcrumb de navegación para las apps de Collector's Forge Studio.
 *
 * Lee la ruta actual con useLocation() y muestra los segmentos en español.
 * El primer segmento (el id de la app) se renderiza con el ícono y el color
 * de la app desde `config/sidebar.js`. Los segmentos siguientes son texto
 * plano (sin enlaces).
 *
 * Solo se renderiza cuando la ruta tiene 2 o más segmentos (ej. /cost/calculator).
 *
 * @module components/Breadcrumb
 */

import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SETTINGS_APP, SIDEBAR_APPS } from '../config/sidebar';

/**
 * Mapa de segmentos de ruta a etiquetas legibles en español.
 * Cubre todas las apps de Collector's Forge Studio.
 */
const SEGMENT_LABELS = {
  /* Apps */
  cost:        'Cost',
  inventory:   'Inventario',
  queue:       'Cola',
  maintenance: 'Mantenimiento',
  company:     'Compañía',
  settings:    'Configuración',
  vault:       'Vault',
  /* Cost */
  calculator:  'Calculadora',
  quotes:      'Cotizaciones',
  manual:      'Nueva Cotización',
  printers:    'Impresoras',
  history:     'Historial',
  /* Inventory */
  filaments:   'Filamentos',
  supplies:    'Insumos',
  tools:       'Herramientas',
  consumables: 'Consumibles',
  stock:       'Todo el stock',
  purchases:   'Pedidos',
  spools:      'Bobinas',
  prints:      'Disponible para Venta',
  io:          'Importar / Exportar',
  categories:  'Categorías',
  /* Maintenance */
  dashboard:   'Estado general',
  logs:        'Historial de logs',
  /* Company */
  profile:     'Perfil',
  branding:    'Marca & Colores',
  templates:   'Templates PDF',
  upload:      'Subir modelo',
  /* Settings */
  account:     'Cuenta',
  users:       'Usuarios',
};

/** Mapa app-id → { icon, color } construido a partir del registro de la sidebar. */
const APP_META_BY_ID = [...SIDEBAR_APPS, SETTINGS_APP].reduce((acc, app) => {
  acc[app.id] = { icon: app.icon, color: app.color };
  return acc;
}, {});

/**
 * Breadcrumb de navegación.
 * Solo se renderiza cuando la ruta tiene 2 o más segmentos.
 *
 * @returns {JSX.Element|null}
 */
export default function Breadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length < 2) return null;

  const appMeta = APP_META_BY_ID[segments[0]];
  const AppIcon = appMeta?.icon;

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center flex-wrap gap-1 text-xs mb-4">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const isFirst = i === 0;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={11} className="text-gunmetal/50 shrink-0" />
            )}
            {isFirst && AppIcon && (
              <AppIcon size={13} style={{ color: appMeta.color }} className="shrink-0" />
            )}
            <span className={isLast ? 'text-steel' : 'text-gunmetal'}>
              {SEGMENT_LABELS[seg] ?? seg}
            </span>
          </span>
        );
      })}
    </nav>
  );
}
