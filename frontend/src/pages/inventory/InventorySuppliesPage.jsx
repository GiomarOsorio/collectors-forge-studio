/**
 * @file Página de insumos del inventario.
 *
 * Vista filtrada del inventario que muestra los ítems que no son filamentos
 * ni herramientas (pegamentos, lubricantes, resinas de postprocesado, etc.).
 * Reutiliza InventoryStockPage con la prop excludeCategories.
 *
 * @module pages/inventory/InventorySuppliesPage
 */

import InventoryStockPage from './InventoryStockPage';

/**
 * Página de insumos: excluye filamentos y herramientas.
 * @returns {JSX.Element}
 */
export default function InventorySuppliesPage() {
  return <InventoryStockPage categoryFilter="Insumo" />;
}
