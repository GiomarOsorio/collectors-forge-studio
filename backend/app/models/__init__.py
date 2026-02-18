"""
Paquete de modelos ORM de Calculator3D.

Re-exporta todas las entidades de base de datos del proyecto para facilitar
las importaciones desde otros módulos. Al importar desde app.models se obtiene
acceso a todos los modelos sin necesidad de conocer su ubicación exacta.

Exportaciones:
    User: Modelo de usuario del sistema.
    Filament: Modelo de filamento de impresión 3D.
    Printer: Modelo de impresora 3D.
    AppSettings: Modelo de configuración de la aplicación por usuario.
    Quote: Modelo de cotización de impresión guardada.
"""

from app.models.user import User
from app.models.filament import Filament
from app.models.printer import Printer
from app.models.settings import AppSettings
from app.models.quote import Quote

__all__ = ["User", "Filament", "Printer", "AppSettings", "Quote"]
