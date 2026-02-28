"""
Utilidades de formateo y validación de imágenes compartidas.

Centraliza funciones y constantes usadas en múltiples módulos para
evitar duplicación y mantener un único punto de mantenimiento.
"""

from typing import Callable, Dict


def _fmt_cop(value: float) -> str:
    """
    Formatea un valor numérico como pesos colombianos.

    Ejemplo: 1234567 → "$ 1.234.567"

    Args:
        value: Monto en COP (se redondea al entero más cercano).

    Returns:
        str: Valor formateado con prefijo "$ " y separadores de miles con punto.
    """
    return "$ " + f"{round(value):,}".replace(",", ".")


# Validadores de magic bytes por content-type de imagen.
# Cada función recibe el contenido binario del archivo y retorna True si es válido.
IMAGE_MAGIC_CHECKS: Dict[str, Callable[[bytes], bool]] = {
    "image/jpeg": lambda c: c[:3] == b"\xff\xd8\xff",
    "image/png":  lambda c: c[:4] == b"\x89PNG",
    "image/webp": lambda c: c[:4] == b"RIFF" and len(c) >= 12 and c[8:12] == b"WEBP",
    "image/gif":  lambda c: c[:6] in (b"GIF87a", b"GIF89a"),
}

# Mapa content-type → extensión de archivo para nombrar imágenes subidas.
# Se basa en el content-type validado, no en el filename del cliente,
# para evitar path traversal y extensiones arbitrarias.
IMAGE_EXT_MAP: Dict[str, str] = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
    "image/gif":  ".gif",
}
