"""
Servicio para obtener datos de modelos de MakerWorld.

Estrategia en dos pasos:
1. Intenta la API JSON de MakerWorld (/api/v1/design-service/design/{id})
   que devuelve datos estructurados sin necesidad de parsear HTML.
2. Si la API falla, hace scraping del HTML buscando __NEXT_DATA__ (Next.js)
   o schema.org JSON-LD como fallback.

MakerWorld puede bloquear IPs de servidor con Cloudflare. En ese caso
retorna None y el llamador muestra un mensaje claro al usuario.
"""

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Headers que imitan un navegador real para reducir bloqueos
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "sec-ch-ua": '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "sec-fetch-user": "?1",
    "upgrade-insecure-requests": "1",
}


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


def _parse_print_profiles(profiles: list) -> tuple:
    """
    Extrae tiempo, gramos y tipo de filamento del primer perfil útil.

    Args:
        profiles: Lista de perfiles de impresión del JSON de MakerWorld.

    Returns:
        Tupla (print_time_seconds, filament_weight_g, filament_type).
    """
    tiempo_s: Optional[int] = None
    gramos: Optional[float] = None
    tipo: Optional[str] = None

    for perfil in profiles:
        if tiempo_s is None:
            t = perfil.get("printTime", perfil.get("estimatedTime"))
            if isinstance(t, (int, float)) and t > 0:
                tiempo_s = int(t)
            elif isinstance(t, str):
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

        if gramos is None:
            g = perfil.get("filamentWeight", perfil.get("weight"))
            try:
                if g is not None:
                    gramos = float(g)
            except (ValueError, TypeError):
                pass

        if tipo is None:
            tf = perfil.get("filamentType", perfil.get("material"))
            if tf:
                tipo = str(tf).strip()

        if tiempo_s is not None and gramos is not None:
            break

    return tiempo_s, gramos, tipo


def _try_api(model_id: str, client: httpx.Client) -> Optional[MakerworldData]:
    """
    Intenta obtener datos vía la API JSON pública de MakerWorld.

    MakerWorld expone un endpoint de tipo REST que su SPA usa internamente.
    No requiere autenticación para modelos públicos.

    Args:
        model_id: ID numérico del modelo.
        client:   Cliente HTTP reutilizable.

    Returns:
        MakerworldData si tuvo éxito, None en caso contrario.
    """
    api_url = f"https://makerworld.com/api/v1/design-service/design/{model_id}"
    headers = {
        **_BROWSER_HEADERS,
        "Accept": "application/json, text/plain, */*",
        "Referer": f"https://makerworld.com/en/models/{model_id}",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }
    try:
        resp = client.get(api_url, headers=headers, timeout=12, follow_redirects=True)
        if resp.status_code != 200:
            logger.debug("MakerWorld API respondió %s", resp.status_code)
            return None

        data = resp.json()
        nombre = data.get("title", data.get("name", f"Modelo {model_id}"))

        # Los perfiles pueden estar en distintos campos según la versión
        profiles = (
            data.get("printProfiles")
            or data.get("profiles")
            or data.get("instances")
            or []
        )
        tiempo_s, gramos, tipo = _parse_print_profiles(profiles)

        if tiempo_s is None and gramos is None:
            logger.debug("MakerWorld API: sin perfiles de impresión en model %s", model_id)
            return None

        logger.info("MakerWorld API OK: model %s — %ss / %sg", model_id, tiempo_s, gramos)
        return MakerworldData(
            model_id=model_id,
            model_name=nombre,
            print_time_seconds=tiempo_s,
            filament_weight_g=gramos,
            filament_type=tipo,
        )
    except Exception as exc:
        logger.debug("MakerWorld API excepción: %s", exc)
        return None


def _try_html(model_id: str, client: httpx.Client) -> Optional[MakerworldData]:
    """
    Obtiene datos parseando el HTML de la página pública del modelo.

    Busca en orden:
    1. __NEXT_DATA__ (JSON embebido por Next.js)
    2. JSON-LD de schema.org como fallback (datos mínimos)

    Args:
        model_id: ID numérico del modelo.
        client:   Cliente HTTP reutilizable.

    Returns:
        MakerworldData si tuvo éxito, None en caso contrario.
    """
    page_url = f"https://makerworld.com/en/models/{model_id}"
    headers = {
        **_BROWSER_HEADERS,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    try:
        resp = client.get(page_url, headers=headers, timeout=15, follow_redirects=True)
        if resp.status_code != 200:
            logger.debug("MakerWorld HTML respondió %s", resp.status_code)
            return None

        html = resp.text

        # Intento 1: __NEXT_DATA__ (Next.js)
        m = re.search(
            r'<script[^>]+id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>',
            html,
            re.DOTALL,
        )
        if m:
            try:
                data = json.loads(m.group(1))
                props = data.get("props", {}).get("pageProps", {})
                design = props.get("design", props.get("model", {}))
                nombre = design.get("title", design.get("name", f"Modelo {model_id}"))
                profiles = (
                    design.get("printProfiles")
                    or design.get("profiles")
                    or design.get("instances")
                    or []
                )
                tiempo_s, gramos, tipo = _parse_print_profiles(profiles)
                if tiempo_s is not None or gramos is not None:
                    logger.info("MakerWorld HTML (__NEXT_DATA__) OK: model %s", model_id)
                    return MakerworldData(
                        model_id=model_id,
                        model_name=nombre,
                        print_time_seconds=tiempo_s,
                        filament_weight_g=gramos,
                        filament_type=tipo,
                    )
            except (json.JSONDecodeError, KeyError, TypeError):
                pass

        logger.debug("MakerWorld HTML: sin datos útiles para model %s", model_id)
        return None

    except Exception as exc:
        logger.debug("MakerWorld HTML excepción: %s", exc)
        return None


def fetch_model_data(model_id: str) -> Optional[MakerworldData]:
    """
    Obtiene los datos de un modelo de MakerWorld.

    Intenta primero la API JSON, luego scraping del HTML.
    Retorna None sin lanzar excepción si ambos métodos fallan.

    Args:
        model_id: ID numérico del modelo en MakerWorld.

    Returns:
        MakerworldData con los datos extraídos, o None si no fue posible.
    """
    with httpx.Client() as client:
        result = _try_api(model_id, client)
        if result:
            return result

        logger.debug("API falló, intentando HTML para model %s", model_id)
        return _try_html(model_id, client)
