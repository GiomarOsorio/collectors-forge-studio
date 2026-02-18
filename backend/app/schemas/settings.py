"""
Esquemas Pydantic para la configuración de la aplicación por usuario.

Define los modelos de validación de datos para los endpoints de configuración.
Dado que la configuración se crea automáticamente con valores por defecto al
registrar un usuario, no existe un schema de creación separado. Solo se exponen
los schemas de actualización y respuesta.
"""

from typing import Optional

from pydantic import BaseModel


class AppSettingsUpdate(BaseModel):
    """
    Esquema para la actualización parcial de la configuración de la aplicación.

    Utilizado en el cuerpo de la solicitud PUT /api/settings/.
    Todos los campos son opcionales, lo que permite al usuario modificar
    únicamente los parámetros que desea ajustar sin necesidad de re-enviar
    la configuración completa.

    Atributos:
        electricity_rate: Nueva tarifa eléctrica en la moneda configurada por
            kWh. Ej: 0.12 para 12 centavos por kWh (opcional).
        failure_rate_percent: Nuevo porcentaje de absorción de fallos de
            impresión. Ej: 5.0 para un 5% (opcional).
        labor_cost_per_hour: Nuevo costo de mano de obra por hora en la
            moneda configurada. Ej: 15.0 (opcional).
        default_margin_percent: Nuevo margen de ganancia por defecto que se
            aplica cuando no se especifica uno en la cotización. Ej: 30.0
            para un 30% (opcional).
        currency: Nuevo código de moneda. Ej: "USD", "EUR", "ARS" (opcional).
    """

    electricity_rate: Optional[float] = None
    failure_rate_percent: Optional[float] = None
    labor_cost_per_hour: Optional[float] = None
    default_margin_percent: Optional[float] = None
    currency: Optional[str] = None


class AppSettingsResponse(BaseModel):
    """
    Esquema de respuesta con la configuración completa de la aplicación.

    Devuelto por los endpoints GET y PUT de /api/settings/.
    Refleja el estado actual de todos los parámetros de configuración del
    usuario autenticado.

    Atributos:
        id: Identificador numérico único del registro de configuración.
        user_id: Identificador del usuario propietario de esta configuración.
        electricity_rate: Tarifa eléctrica actual por kWh.
        failure_rate_percent: Porcentaje de absorción de fallos actual.
        labor_cost_per_hour: Costo de mano de obra por hora actual.
        default_margin_percent: Margen de ganancia por defecto actual.
        currency: Código de moneda actualmente configurado.
    """

    id: int
    user_id: int
    electricity_rate: float
    failure_rate_percent: float
    labor_cost_per_hour: float
    default_margin_percent: float
    currency: str

    # Permite construir el schema a partir de instancias ORM (from_orm)
    model_config = {"from_attributes": True}
