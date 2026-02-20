"""
Paquete de modelos ORM de Calculator3D.

Re-exporta todas las entidades de base de datos del proyecto para facilitar
las importaciones desde otros módulos. Al importar desde app.models se obtiene
acceso a todos los modelos sin necesidad de conocer su ubicación exacta.

Exportaciones:
    Company:            Modelo de empresa (unidad de aislamiento multi-tenant).
    User:               Modelo de usuario del sistema.
    Filament:           Modelo de filamento de impresión 3D.
    Printer:            Modelo de impresora 3D.
    AppSettings:        Modelo de configuración de la aplicación por empresa.
    Quote:              Modelo de costo de impresión guardado (historial calculadora).
    ClientQuote:        Modelo de cotización de cliente con múltiples productos.
    Supply:             Modelo de insumo adicional del catálogo (argollas, etc.).
    ElectricityTariff:  Modelo de tarifa de electricidad EPM por mes y estrato.
    InventoryItem:      Modelo de ítem de inventario de la empresa.
    PurchaseOrder:      Modelo de orden de compra a proveedores.
    PurchaseOrderItem:  Modelo de línea de ítem de una orden de compra.
    SlicingJob:         Modelo de trabajo de laminado 3D (OrcaSlicer / Bambu Studio).
"""

from app.models.company import Company
from app.models.user import User
from app.models.filament import Filament
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.models.quote import Quote
from app.models.client_quote import ClientQuote
from app.models.supply import Supply
from app.models.electricity_tariff import ElectricityTariff
from app.models.inventory import InventoryItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.slicing_job import SlicingJob

__all__ = [
    "Company", "User", "Filament", "Printer", "AppSettings",
    "Quote", "ClientQuote", "Supply", "ElectricityTariff",
    "InventoryItem", "PurchaseOrder", "PurchaseOrderItem",
    "SlicingJob",
]
