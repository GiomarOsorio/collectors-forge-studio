"""
Paquete de modelos ORM de collectors-forge-studio.

Re-exporta todas las entidades de base de datos del proyecto para facilitar
las importaciones desde otros módulos. Al importar desde app.models se obtiene
acceso a todos los modelos sin necesidad de conocer su ubicación exacta.

Exportaciones:
    Company:             Modelo de empresa (unidad de aislamiento multi-tenant).
    CompanyTemplate:     Modelo de template Liquid de cotización por empresa.
    User:                Modelo de usuario del sistema.
    Filament:            Modelo de filamento de impresión 3D.
    Printer:             Modelo de impresora 3D.
    AppSettings:         Modelo de configuración de la aplicación por empresa.
    Quote:               Modelo de costo de impresión guardado (historial calculadora).
    ClientQuote:         Modelo de cotización de cliente con múltiples productos.
    Supply:              Modelo de insumo adicional del catálogo (argollas, etc.).
    ElectricityTariff:   Modelo de tarifa de electricidad EPM por mes y estrato.
    InventoryItem:       Modelo de ítem de inventario de la empresa.
    InventoryCategory:   Modelo de categoría de inventario configurable por empresa.
    PurchaseOrder:       Modelo de orden de compra a proveedores.
    PurchaseOrderItem:   Modelo de línea de ítem de una orden de compra.
    PrintedItem:         Modelo de ítem de impresión 3D del catálogo de productos.
"""

from app.models.company import Company
from app.models.company_template import CompanyTemplate
from app.models.user import User
from app.models.filament import Filament
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.models.quote import Quote
from app.models.client_quote import ClientQuote
from app.models.supply import Supply
from app.models.electricity_tariff import ElectricityTariff
from app.models.inventory import InventoryItem
from app.models.inventory_category import InventoryCategory
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from app.models.printed_item import PrintedItem
from app.models.maintenance import MaintenanceLog, MaintenanceLogItem
from app.models.queue import PrintQueueItem
from app.models.model_file import ModelFile, ModelFilePlate
from app.models.vault_folder import VaultFolder
from app.models.filament_profile import FilamentProfile
from app.models.project import Project

__all__ = [
    "Company", "CompanyTemplate", "User", "Filament", "Printer", "AppSettings",
    "Quote", "ClientQuote", "Supply", "ElectricityTariff",
    "InventoryItem", "InventoryCategory", "PurchaseOrder", "PurchaseOrderItem",
    "PrintedItem",
    "MaintenanceLog", "MaintenanceLogItem",
    "PrintQueueItem",
    "ModelFile", "ModelFilePlate",
    "VaultFolder",
    "FilamentProfile",
    "Project",
]
