/**
 * @file Breadcrumb de navegación para las apps de TurtleForge Studio.
 *
 * Lee la ruta actual con useLocation() y muestra los segmentos en español.
 * Solo se renderiza cuando la ruta tiene 2 o más segmentos (ej. /cost/calculator).
 * Los segmentos se muestran como texto plano (sin enlaces) para evitar
 * navegar a rutas intermedias que pueden no existir.
 *
 * @module components/Breadcrumb
 */

import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Mapa de segmentos de ruta a etiquetas legibles en español.
 * Cubre todas las apps de TurtleForge Studio.
 */
const SEGMENT_LABELS = {
  /* Apps */
  cost:        'Cost',
  inventory:   'Inventario',
  queue:       'Cola',
  maintenance: 'Mantenimiento',
  company:     'Compañía',
  slicer:      'Slicer',
  settings:    'Configuración',
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
  prints:      'Disponible para Venta',
  io:          'Importar / Exportar',
  categories:  'Categorías',
  /* Queue */
  /* history ya está arriba */
  /* Maintenance */
  dashboard:   'Estado general',
  logs:        'Historial de logs',
  /* Company */
  profile:     'Perfil',
  branding:    'Marca & Colores',
  templates:   'Templates PDF',
  /* Slicer */
  upload:      'Subir modelo',
  /* Settings */
  account:     'Cuenta',
  users:       'Usuarios',
};

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

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center flex-wrap gap-1 text-xs mb-4">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight size={11} className="text-gunmetal/50 shrink-0" />
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
