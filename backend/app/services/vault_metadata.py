"""
Servicio para extraer metadata de modelos 3D desde URLs externas.

Soporta tres plataformas:
- MakerWorld: API JSON pública (reutiliza lógica del makerworld_fetcher)
- Printables: GraphQL público en api.printables.com
- Thingiverse / otras: Open Graph tags (og:title, og:image, og:description)

El endpoint de metadata es de acceso público pero requiere autenticación
para reducir el abuso.
"""

import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Headers que imitan un navegador para reducir bloqueos de Cloudflare
_BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "es-419,es;q=0.9,en;q=0.8",
}

# Timeout para peticiones externas
_TIMEOUT = 12.0


def _detect_platform(url: str) -> str:
    """Detecta la plataforma a partir de la URL."""
    url_lower = url.lower()
    if "makerworld.com" in url_lower:
        return "makerworld"
    if "printables.com" in url_lower:
        return "printables"
    if "thingiverse.com" in url_lower:
        return "thingiverse"
    return "otro"


def _mw_thumbnail(data: dict) -> Optional[str]:
    """
    Extrae la URL de thumbnail del JSON de MakerWorld probando varios nombres de campo
    usados en distintas versiones de la API.
    """
    # Intento 1: array de imágenes de portada
    for key in ("coverFiles", "coverMedias", "medias", "media", "images", "files"):
        arr = data.get(key)
        if arr and isinstance(arr, list):
            first = arr[0]
            if isinstance(first, dict):
                url = first.get("url") or first.get("filePath") or first.get("path")
                if url:
                    return url

    # Intento 2: campo escalar
    for key in ("coverUrl", "coverFile", "thumbnailUrl", "previewImageUrl", "imageUrl"):
        val = data.get(key)
        if val and isinstance(val, str):
            return val

    return None


def _mw_creator(data: dict) -> tuple:
    """
    Extrae (creator_name, creator_url) del JSON de MakerWorld probando varios campos.
    """
    for key in ("designerUser", "designer", "user", "author", "uploader", "creatorUser"):
        creator = data.get(key)
        if creator and isinstance(creator, dict):
            name = (
                creator.get("name")
                or creator.get("nickname")
                or creator.get("username")
                or creator.get("displayName")
            )
            if name:
                handle = (
                    creator.get("handle")
                    or creator.get("slug")
                    or creator.get("uid")
                )
                url = f"https://makerworld.com/en/@{handle}" if handle else None
                return name, url

    return None, None


async def _fetch_makerworld(url: str) -> Optional[dict]:
    """
    Extrae metadata de MakerWorld.

    Estrategia:
    1. Llama a la API JSON para obtener nombre, thumbnail y creador.
    2. Para los campos que sigan siendo None (thumbnail, description, creator),
       complementa con Open Graph del HTML público.
    """
    m = re.search(r"makerworld\.com(?:/[a-z]{2})?/models/(\d+)", url, re.IGNORECASE)
    if not m:
        return None
    model_id = m.group(1)

    api_url = f"https://makerworld.com/api/v1/design-service/design/{model_id}"
    headers = {
        **_BROWSER_HEADERS,
        "Accept": "application/json, text/plain, */*",
        "Referer": f"https://makerworld.com/en/models/{model_id}",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
    }

    result = {
        "name": None,
        "description": None,
        "thumbnail_url": None,
        "source_platform": "makerworld",
        "creator_name": None,
        "creator_url": None,
    }

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(api_url, headers=headers, timeout=_TIMEOUT, follow_redirects=True)
            if resp.status_code == 200:
                data = resp.json()
                result["name"] = data.get("title") or data.get("name")
                result["description"] = (
                    data.get("description")
                    or data.get("summary")
                    or data.get("designSummary")
                    or data.get("shortDescription")
                ) or None
                result["thumbnail_url"] = _mw_thumbnail(data)
                result["creator_name"], result["creator_url"] = _mw_creator(data)
                logger.debug(
                    "MakerWorld API: name=%s thumb=%s creator=%s",
                    result["name"], result["thumbnail_url"], result["creator_name"],
                )
        except Exception as exc:
            logger.debug("MakerWorld API metadata excepción: %s", exc)

    # Complementar con Open Graph para los campos que aún sean None
    missing = not result["thumbnail_url"] or not result["description"] or not result["name"]
    if missing:
        og = await _fetch_open_graph(url, "makerworld")
        if og:
            if not result["name"]:
                result["name"] = og.get("name")
            if not result["description"]:
                result["description"] = og.get("description")
            if not result["thumbnail_url"]:
                result["thumbnail_url"] = og.get("thumbnail_url")

    return result if result["name"] else None


async def _fetch_printables(url: str) -> Optional[dict]:
    """
    Extrae metadata de Printables usando su GraphQL público.

    GraphQL endpoint: https://api.printables.com/graphql (sin auth para modelos públicos).
    """
    m = re.search(r"printables\.com/model/(\d+)", url, re.IGNORECASE)
    if not m:
        return None
    model_id = m.group(1)

    query = """
    query PrintProfile($id: ID!) {
      print(id: $id) {
        name
        summary
        image { filePath }
        user { publicUsername handle }
      }
    }
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.printables.com/graphql",
                json={"query": query, "variables": {"id": model_id}},
                headers={**_BROWSER_HEADERS, "Content-Type": "application/json"},
                timeout=_TIMEOUT,
            )
            if resp.status_code == 200:
                data = resp.json().get("data", {}).get("print") or {}
                if data:
                    img = data.get("image") or {}
                    thumb = img.get("filePath")
                    if thumb and not thumb.startswith("http"):
                        thumb = f"https://media.printables.com/{thumb}"

                    user = data.get("user") or {}
                    username = user.get("publicUsername") or user.get("handle")
                    creator_url = f"https://www.printables.com/@{username}" if username else None

                    return {
                        "name": data.get("name"),
                        "description": data.get("summary"),
                        "thumbnail_url": thumb,
                        "source_platform": "printables",
                        "creator_name": username,
                        "creator_url": creator_url,
                    }
    except Exception as exc:
        logger.debug("Printables GraphQL metadata excepción: %s", exc)

    # Fallback: Open Graph
    return await _fetch_open_graph(url, "printables")


async def _fetch_open_graph(url: str, platform: str = "otro") -> Optional[dict]:
    """
    Extrae metadata Open Graph (og:title, og:image, og:description) de cualquier URL.

    Funciona como fallback universal para Thingiverse y otras plataformas
    que no tienen API pública documentada.
    """
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url,
                headers={**_BROWSER_HEADERS, "Accept": "text/html,*/*"},
                timeout=_TIMEOUT,
                follow_redirects=True,
            )
            if resp.status_code != 200:
                return None
            html = resp.text

            def _og(prop: str) -> Optional[str]:
                m = re.search(
                    rf'<meta[^>]+property=["\']og:{prop}["\'][^>]+content=["\']([^"\']+)["\']',
                    html,
                    re.IGNORECASE,
                )
                if m:
                    return m.group(1)
                # Orden inverso de atributos
                m = re.search(
                    rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:{prop}["\']',
                    html,
                    re.IGNORECASE,
                )
                return m.group(1) if m else None

            return {
                "name": _og("title"),
                "description": _og("description"),
                "thumbnail_url": _og("image"),
                "source_platform": platform,
                "creator_name": None,
                "creator_url": None,
            }
    except Exception as exc:
        logger.debug("Open Graph fetch excepción (%s): %s", url, exc)
        return None


async def fetch_metadata(url: str) -> dict:
    """
    Extrae metadata de un modelo 3D a partir de su URL pública.

    Detecta la plataforma automáticamente y delega al fetcher correspondiente.
    Si todos fallan retorna un dict vacío para no romper el formulario.

    Args:
        url: URL pública del modelo en MakerWorld, Printables, Thingiverse u otra.

    Returns:
        Dict con los campos: name, description, thumbnail_url, source_platform,
        creator_name, creator_url. Los valores pueden ser None.
    """
    platform = _detect_platform(url)

    result = None
    try:
        if platform == "makerworld":
            result = await _fetch_makerworld(url)
        elif platform == "printables":
            result = await _fetch_printables(url)
        else:
            result = await _fetch_open_graph(url, platform)
    except Exception as exc:
        logger.error("Error inesperado en fetch_metadata: %s", exc)

    if result is None:
        result = {
            "name": None,
            "description": None,
            "thumbnail_url": None,
            "source_platform": platform,
            "creator_name": None,
            "creator_url": None,
        }

    # Garantizar que source_url está presente en la respuesta
    result["source_url"] = url
    return result
