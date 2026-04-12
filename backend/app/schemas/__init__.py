"""
Paquete de esquemas Pydantic de collectors-forge-studio.

Re-exporta todos los schemas de validación y serialización de datos del
proyecto para facilitar las importaciones desde otros módulos. Al importar
desde app.schemas se obtiene acceso a todos los schemas disponibles sin
necesidad de conocer su ubicación exacta dentro del paquete.

Exportaciones:
    UserCreate: Schema para crear un nuevo usuario.
    UserResponse: Schema de respuesta con datos del usuario.
    UserLogin: Schema para inicio de sesión.
    Token: Schema de respuesta del token JWT.
    TokenData: Schema interno para los datos del payload JWT.
    FilamentCreate: Schema para crear un filamento.
    FilamentUpdate: Schema para actualizar un filamento.
    FilamentResponse: Schema de respuesta con datos del filamento.
    PrinterCreate: Schema para crear una impresora.
    PrinterUpdate: Schema para actualizar una impresora.
    PrinterResponse: Schema de respuesta con datos de la impresora.
    AppSettingsUpdate: Schema para actualizar la configuración.
    AppSettingsResponse: Schema de respuesta con la configuración.
    QuoteCalculateRequest: Schema de solicitud para calcular una cotización.
    QuoteResponse: Schema de respuesta con datos de una cotización guardada.
    QuoteCostBreakdown: Schema con el desglose de costos de una cotización.
"""

from app.schemas.user import UserCreate, UserResponse, UserLogin, Token, TokenData
from app.schemas.filament import FilamentCreate, FilamentUpdate, FilamentResponse
from app.schemas.printer import PrinterCreate, PrinterUpdate, PrinterResponse
from app.schemas.settings import AppSettingsUpdate, AppSettingsResponse
from app.schemas.quote import (
    QuoteCalculateRequest,
    QuoteResponse,
    QuoteCostBreakdown,
)

__all__ = [
    "UserCreate", "UserResponse", "UserLogin", "Token", "TokenData",
    "FilamentCreate", "FilamentUpdate", "FilamentResponse",
    "PrinterCreate", "PrinterUpdate", "PrinterResponse",
    "AppSettingsUpdate", "AppSettingsResponse",
    "QuoteCalculateRequest", "QuoteResponse", "QuoteCostBreakdown",
]
