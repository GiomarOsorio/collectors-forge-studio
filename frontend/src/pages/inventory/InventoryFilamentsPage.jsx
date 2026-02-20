/**
 * @file Página de filamentos del inventario.
 *
 * Vista filtrada del inventario que muestra únicamente los ítems con
 * category="Filamento". Reutiliza InventoryStockPage con la prop categoryFilter.
 *
 * @module pages/inventory/InventoryFilamentsPage
 */

import InventoryStockPage from './InventoryStockPage';

/**
 * Página de filamentos: muestra solo ítems de categoría "Filamento".
 * @returns {JSX.Element}
 */
export default function InventoryFilamentsPage() {
  return <InventoryStockPage categoryFilter="Filamento" />;
}
