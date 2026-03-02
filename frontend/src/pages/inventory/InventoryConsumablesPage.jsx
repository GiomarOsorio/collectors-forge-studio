/**
 * @file Página de consumibles del inventario.
 *
 * Vista filtrada del inventario que muestra los ítems de categoría
 * "Consumible" (boquillas, calcetas de silicona, filtros de carbón, etc.).
 * Los consumibles tienen dos campos extra: useful_life_hours y unit_cost_cal,
 * que la calculadora usa para calcular el desgaste proporcional al tiempo
 * de impresión de forma automática (sin intervención manual por impresión).
 *
 * Reutiliza InventoryStockPage con la prop categoryFilter.
 *
 * @module pages/inventory/InventoryConsumablesPage
 */

import InventoryStockPage from './InventoryStockPage';

/**
 * Página de consumibles: fija la categoría a 'Consumible'.
 * @returns {JSX.Element}
 */
export default function InventoryConsumablesPage() {
  return <InventoryStockPage categoryFilter="Consumible" />;
}
