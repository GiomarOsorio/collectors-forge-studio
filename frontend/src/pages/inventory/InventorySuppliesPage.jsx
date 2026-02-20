/**
 * @file Página de insumos del inventario.
 *
 * Vista filtrada del inventario que muestra todos los ítems excepto los
 * de categoría "Filamento" (es decir, accesorios, herramientas, repuestos,
 * insumos de postprocesado, etc.). Reutiliza InventoryStockPage con la
 * prop excludeCategory.
 *
 * @module pages/inventory/InventorySuppliesPage
 */

import InventoryStockPage from './InventoryStockPage';

/**
 * Página de insumos: muestra todos los ítems que NO son filamentos.
 * @returns {JSX.Element}
 */
export default function InventorySuppliesPage() {
  return <InventoryStockPage excludeCategory="Filamento" />;
}
