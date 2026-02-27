/**
 * @file Página de herramientas y suplementos del inventario.
 *
 * Vista filtrada del inventario que muestra únicamente los ítems de
 * categoría "Herramienta" (nozzles, espátulas, adhesivos, repuestos,
 * herramientas de postprocesado, etc.). Reutiliza InventoryStockPage
 * con la prop categoryFilter.
 *
 * @module pages/inventory/InventoryToolsPage
 */

import InventoryStockPage from './InventoryStockPage';

/**
 * Página de herramientas: muestra únicamente ítems de categoría "Herramienta".
 * @returns {JSX.Element}
 */
export default function InventoryToolsPage() {
  return <InventoryStockPage categoryFilter="Herramienta" />;
}
