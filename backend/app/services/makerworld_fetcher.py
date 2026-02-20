"""
Servicio para obtener datos de modelos de MakerWorld.

Extrae estimaciones de tiempo de impresión y uso de filamento de las
páginas de modelos en MakerWorld (makerworld.com). Los datos se obtienen
parseando el JSON embebido en el HTML generado por Next.js (__NEXT_DATA__).

NOTA: MakerWorld puede bloquear requests sin autenticación (HTTP 403).
Este servicio intenta el acceso con headers de navegador estándar.
Si falla, retorna None y el llamador muestra un mensaje amigable al usuario.
"""

import json
import re
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Optional


@dataclass
class MakerworldData:
    """
    Datos extraídos de la página de un modelo de MakerWorld.

    Contiene las estimaciones de tiempo y filamento publicadas por el
    creador del modelo. Estos valores son aproximados y corresponden al
    perfil de impresión que el uploader eligió al publicar.
    """
    model_id: str
    model_name: str
    print_time_seconds: Optional[int] = None
    filament_weight_g: Optional[float] = None
    filament_type: Optional[str] = None


def extract_model_id(url: str) -> Optional[str]:
    """
    Extrae el ID numérico de un modelo a partir de su URL de MakerWorld.

    Soporta los formatos:
    - https://makerworld.com/en/models/12345
    - https://makerworld.com/en/models/12345-nombre-del-modelo
    - https://makerworld.com/models/12345
    - https://www.makerworld.com/en/models/12345-nombre

    Args:
        url: URL de MakerWorld del modelo.

    Returns:
        ID numérico como string, o None si no se pudo extraer.
    """
    m = re.search(r"makerworld\.com(?:/[a-z]{2})?/models/(\d+)", url, re.IGNORECASE)
    if m:
        return m.group(1)
    return None


def _parse_next_data(html: str, model_id: str) -> Optional[MakerworldData]:
    """
    Extrae los datos del modelo del JSON __NEXT_DATA__ embebido en el HTML.

    Next.js embebe el estado inicial de la página en un tag:
    <script id="__NEXT_DATA__" type="application/json">{...}</script>

    Args:
        html:     Contenido HTML de la página del modelo.
        model_id: ID del modelo (para incluir en el resultado).

    Returns:
        MakerworldData con los datos extraídos, o None si no se encontraron.
    """
    # Buscar el bloque __NEXT_DATA__
    m = re.search(
        r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
        html,
        re.DOTALL,
    )
    if not m:
        return None

    try:
        data = json.loads(m.group(1))
    except json.JSONDecodeError:
        return None

    # Navegar la estructura del JSON de MakerWorld
    # La estructura puede variar; intentamos múltiples rutas
    nombre = f"Modelo {model_id}"
    tiempo_s: Optional[int] = None
    gramos: Optional[float] = None
    tipo_filamento: Optional[str] = None

    try:
        props = data.get("props", {}).get("pageProps", {})

        # Nombre del modelo
        design = props.get("design", props.get("model", {}))
        nombre = design.get("title", design.get("name", nombre))

        # Buscar perfiles de impresión (print profiles)
        perfiles = design.get("printProfiles", design.get("profiles", []))
        if not perfiles and "instances" in design:
            perfiles = design["instances"]

        for perfil in perfiles:
            # Tiempo estimado (en segundos o en formato legible)
            t = perfil.get("printTime", perfil.get("estimatedTime", None))
            if t is not None and tiempo_s is None:
                if isinstance(t, (int, float)):
                    tiempo_s = int(t)
                elif isinstance(t, str):
                    # Puede venir como "2h 15m" o "135m" o "8100s"
                    total = 0
                    for val, unit in re.findall(r"(\d+)\s*([hms])", t):
                        if unit == "h":
                            total += int(val) * 3600
                        elif unit == "m":
                            total += int(val) * 60
                        elif unit == "s":
                            total += int(val)
                    if total > 0:
                        tiempo_s = total

            # Gramos de filamento
            g = perfil.get("filamentWeight", perfil.get("weight", None))
            if g is not None and gramos is None:
                try:
                    gramos = float(g)
                except (ValueError, TypeError):
                    pass

            # Tipo de filamento
            tf = perfil.get("filamentType", perfil.get("material", None))
            if tf and tipo_filamento is None:
                tipo_filamento = str(tf).strip()

            # Salir si ya tenemos los datos principales
            if tiempo_s is not None and gramos is not None:
                break

    except (KeyError, TypeError, AttributeError):
        pass

    # Si no extraímos nada útil, retornar None
    if tiempo_s is None and gramos is None:
        return None

    return MakerworldData(
        model_id=model_id,
        model_name=nombre,
        print_time_seconds=tiempo_s,
        filament_weight_g=gramos,
        filament_type=tipo_filamento,
    )


def fetch_model_data(model_id: str) -> Optional[MakerworldData]:
    """
    Obtiene los datos de un modelo de MakerWorld haciendo fetch de su página.

    Intenta acceder a la página pública del modelo con headers de navegador
    estándar para evitar bloqueos básicos de bots. Si MakerWorld devuelve
    un error HTTP o no se encuentran los datos en el HTML, retorna None
    sin lanzar excepción.

    Args:
        model_id: ID numérico del modelo en MakerWorld.

    Returns:
        MakerworldData con los datos extraídos, o None si no fue posible.
    """
    url = f"https://makerworld.com/en/models/{model_id}"
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
    }

    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            # Detectar encoding
            content_type = resp.headers.get("Content-Type", "")
            encoding = "utf-8"
            if "charset=" in content_type:
                encoding = content_type.split("charset=")[-1].strip()
            html = resp.read().decode(encoding, errors="ignore")

        return _parse_next_data(html, model_id)

    except urllib.error.HTTPError:
        # 403 Forbidden u otro error HTTP — MakerWorld bloqueó el request
        return None
    except urllib.error.URLError:
        # Error de red o timeout
        return None
    except Exception:
        return None
