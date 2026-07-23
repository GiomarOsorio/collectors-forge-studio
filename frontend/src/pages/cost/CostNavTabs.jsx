/**
 * @file Segundo nivel de la app Cost como AppTabs de página. Las 6 rutas
 * vienen de `SIDEBAR_APPS` (`config/sidebar.js`), fuente de verdad única:
 * Cotizaciones · Calcular pieza · Nueva cotización · Historial · Impresoras ·
 * Tarifa & ajustes. Se monta en cada página del módulo Cost (CostPage,
 * Calculator, ManualQuote, History, Printers, CostSettings) para tener UNA
 * sola sub-nav consolidada (antes CostPage tenía tabs in-page propios).
 *
 * @module pages/cost/CostNavTabs
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { AppTabs } from '../../components/ui';
import { SIDEBAR_APPS } from '../../config/sidebar';

const COST_APP = SIDEBAR_APPS.find((a) => a.id === 'cost');
const ITEMS = COST_APP.items.map((it) => ({ id: it.to, label: it.label, icon: it.icon }));

/**
 * @param {Object} props
 * @param {string} [props.className]
 */
export default function CostNavTabs({ className }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <AppTabs
      items={ITEMS}
      value={location.pathname}
      onChange={(to) => navigate(to)}
      accent={COST_APP.color}
      className={className}
    />
  );
}
