"""
Esquemas Pydantic para la gestión de filamentos de impresión 3D.

Define los modelos de validación de datos utilizados en los endpoints CRUD
de filamentos. Separa los contratos de entrada (creación y actualización)
del contrato de salida (respuesta), siguiendo el principio de separación
de responsabilidades.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class FilamentCreate(BaseModel):
    """
    Esquema para la creación de un nuevo filamento.

    Utilizado en el cuerpo de la solicitud POST /api/filaments/.
    Todos los campos requeridos deben proporcionarse; los campos opcionales
    tienen valores por defecto que cubren el caso más común (filamento PLA
    de 1 kg y 1.75 mm de diámetro).

    Atributos:
        brand: Nombre del fabricante. Ej: eSun, Bambu, Polymaker, Prusament.
        type: Tipo de material. Ej: PLA, PETG, ABS, TPU, ASA, PA-CF.
        color: Descripción del color del filamento. Ej: Blanco, Azul marino.
        price_per_kg: Precio de compra por kilogramo en la moneda configurada.
        weight_per_roll: Peso neto del carrete en gramos. Por defecto 1000 g.
        diameter: Diámetro del filamento en mm. Por defecto 1.75 mm (estándar FDM).
        density: Densidad del material en g/cm³. Por defecto 1.24 (PLA estándar).
        notes: Notas opcionales. Ej: "Filamento para piezas técnicas".
    """

    brand: str
    type: str
    color: str
    price_per_kg: float
    weight_per_roll: float = 1000.0
    diameter: float = 1.75
    density: float = 1.24
    notes: Optional[str] = None


class FilamentUpdate(BaseModel):
    """
    Esquema para la actualización parcial de un filamento existente.

    Utilizado en el cuerpo de la solicitud PUT /api/filaments/{id}.
    Todos los campos son opcionales; solo se actualizan los campos que se
    envíen en la solicitud (actualización parcial tipo PATCH semántico).

    Atributos:
        brand: Nuevo nombre del fabricante (opcional).
        type: Nuevo tipo de material (opcional).
        color: Nuevo color (opcional).
        price_per_kg: Nuevo precio por kilogramo (opcional).
        weight_per_roll: Nuevo peso por carrete en gramos (opcional).
        diameter: Nuevo diámetro en mm (opcional).
        density: Nueva densidad en g/cm³ (opcional).
        notes: Nuevas notas (opcional).
    """

    brand: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    price_per_kg: Optional[float] = None
    weight_per_roll: Optional[float] = None
    diameter: Optional[float] = None
    density: Optional[float] = None
    notes: Optional[str] = None


class FilamentResponse(BaseModel):
    """
    Esquema de respuesta con los datos completos de un filamento.

    Devuelto por los endpoints GET, POST y PUT del recurso filamentos.
    Incluye todos los campos del modelo, incluidos los generados
    automáticamente por la base de datos (id, timestamps).

    Atributos:
        id: Identificador numérico único del filamento.
        brand: Nombre del fabricante.
        type: Tipo de material.
        color: Color del filamento.
        price_per_kg: Precio por kilogramo.
        weight_per_roll: Peso del carrete en gramos.
        diameter: Diámetro en milímetros.
        density: Densidad en g/cm³.
        notes: Notas adicionales (puede ser None).
        created_at: Fecha y hora UTC de creación del registro.
        updated_at: Fecha y hora UTC de la última modificación.
    """

    id: int
    brand: str
    type: str
    color: str
    price_per_kg: float
    weight_per_roll: float
    diameter: float
    density: float
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    # Permite construir el schema a partir de instancias ORM (from_orm)
    model_config = {"from_attributes": True}
