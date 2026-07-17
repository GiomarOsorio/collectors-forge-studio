/**
 * @file Segundo nivel de la app Inventario como AppTabs de página (issue
 * #181 — la sidebar ya no tiene subnav). Las 5 rutas vienen de
 * `SIDEBAR_APPS` (`config/sidebar.js`), fuente de verdad única de la lista
 * — evita repetir labels/íconos en cada una de las 5 páginas que lo montan
 * (InventoryPage + Purchases/Prints/Spools/ImportExport).
 *
 * Las categorías de la pestaña Resumen (Filamentos/Insumos/Herramientas/
 * Consumibles/Compras) son un filtro DENTRO de esa página, no una ruta —
 * quedan como fila aparte debajo de este componente (`CategoryTabs` en
 * `InventoryPage.jsx`).
 *
 * @module pages/inventory/InventoryNavTabs
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { AppTabs } from '../../components/ui';
import { SIDEBAR_APPS } from '../../config/sidebar';

const INVENTORY_APP = SIDEBAR_APPS.find((a) => a.id === 'inventory');
const ITEMS = INVENTORY_APP.items.map((it) => ({ id: it.to, label: it.label, icon: it.icon }));

/**
 * @param {Object} props
 * @param {string} [props.className]
 */
export default function InventoryNavTabs({ className }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <AppTabs
      items={ITEMS}
      value={location.pathname}
      onChange={(to) => navigate(to)}
      accent={INVENTORY_APP.color}
      className={className}
    />
  );
}
