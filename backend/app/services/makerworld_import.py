"""
Servicio de import completo de modelos MakerWorld al Vault (issue #139).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 —
`backend/app/services/makerworld.py` (endpoints/headers reverse-engineered
de `kloshi-io/makerworld-api-reverse`, Apache-2.0). Solo interoperabilidad,
sin afiliación con MakerWorld/Bambu Lab.

Diferencia con `services/makerworld_fetcher.py` (ya existente en CFS):
el fetcher scrapea metadata pública sin autenticación (usado en
`POST /vault/fetch-metadata` para pre-llenar el form de subida manual).
Este módulo, en cambio, usa el token de Bambu Cloud para **descargar el
.3mf real** vía el endpoint `iot-service` y lo guarda directo en el Vault
(slot `source_file`) — requiere login.

## Instancia vs. plate

Cada "instancia" de MakerWorld (`design.instances[]`, `profileId`) es un
perfil de impresión distinto para el mismo diseño (ej. "0.2mm" vs "0.4mm
multicolor") — NO es lo mismo que un `ModelFilePlate` (una placa dentro de
UN `.3mf`). Al importar una instancia se descarga SU `.3mf` propio, que
puede a su vez contener múltiples plates — esos se parsean como siempre
(`ModelFilePlate`) al pasar por el mismo camino de upload que #127/#129.
"Importar todos" = una entrada `ModelFile` POR instancia, no por plate.
"""

from __future__ import annotations

import asyncio
import logging
import re
import uuid
from typing import Optional
from urllib.parse import urlparse, urlunparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.model_file import ModelFile
from app.models.makerworld_import import MakerworldImport
from app.models.vault_folder import VaultFolder
from app.routers.vault import (
    _extract_source_thumbnail_png,
    _get_used_bytes,
    _persist_plates_from_print_file,
    _source_content_type,
)
from app.services.thumbnail_extractor import save_thumbnail
from app.services.vault_storage import upload_file

logger = logging.getLogger(__name__)

MAKERWORLD_API_BASE = "https://api.bambulab.com/v1/design-service"
MAKERWORLD_HOST = "makerworld.com"
MAKERWORLD_CDN_HOSTS = ("makerworld.bblmw.com", "public-cdn.bblmw.com")
_ALLOWED_DOWNLOAD_SUFFIXES = (".amazonaws.com",)

_USER_AGENT = "CollectorsForgeStudio/1.0 (+https://github.com/GiomarOsorio/collectors-forge-studio)"
_CLIENT_HEADERS = {
    "User-Agent": _USER_AGENT,
    "Accept": "text/html,application/json,*/*",
    "Referer": "https://makerworld.com/",
}

_MODEL_ID_RE = re.compile(r"/models/(\d+)")
_MAX_3MF_BYTES = 200 * 1024 * 1024


class MakerWorldError(Exception):
    """Excepción base."""


class MakerWorldAuthError(MakerWorldError):
    """Requiere login de Bambu Cloud o el token fue rechazado."""


class MakerWorldForbiddenError(MakerWorldError):
    """MakerWorld rechaza el acceso al recurso (gated/región/puntos)."""


class MakerWorldNotFoundError(MakerWorldError):
    """El diseño/perfil no existe."""


class MakerWorldUnavailableError(MakerWorldError):
    """5xx, red, o payload inesperado."""


class MakerWorldUrlError(MakerWorldError):
    """La URL no es de MakerWorld."""


def parse_makerworld_url(url: str) -> int:
    """Extrae el `design_id` entero de una URL de MakerWorld. Rechaza otros hosts."""
    if not url or not isinstance(url, str):
        raise MakerWorldUrlError("URL vacía")
    candidate = url.strip()
    if "://" not in candidate:
        candidate = "https://" + candidate
    parsed = urlparse(candidate)
    host = (parsed.hostname or "").lower()
    if host != MAKERWORLD_HOST and not host.endswith("." + MAKERWORLD_HOST):
        raise MakerWorldUrlError(f"No es una URL de MakerWorld (host={host!r})")
    match = _MODEL_ID_RE.search(parsed.path)
    if not match:
        raise MakerWorldUrlError("La URL no contiene /models/{id}")
    return int(match.group(1))


class MakerWorldClient:
    """Cliente async de la API de diseño de MakerWorld + descarga vía Bambu Cloud."""

    def __init__(self, client: Optional[httpx.AsyncClient] = None, auth_token: Optional[str] = None):
        self._client = client or httpx.AsyncClient(timeout=30.0)
        self._owns_client = client is None
        self._auth_token = auth_token

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    def _headers(self) -> dict:
        headers = dict(_CLIENT_HEADERS)
        if self._auth_token:
            headers["Authorization"] = f"Bearer {self._auth_token}"
        return headers

    async def _get_json(self, path: str) -> dict:
        url = f"{MAKERWORLD_API_BASE}{path}"
        try:
            response = await self._client.get(url, headers=self._headers(), timeout=30.0)
        except httpx.HTTPError as exc:
            raise MakerWorldUnavailableError(f"Petición a MakerWorld falló: {exc}") from exc

        if response.status_code == 401:
            raise MakerWorldAuthError(f"MakerWorld rechazó el token para {path}")
        if response.status_code == 403:
            raise MakerWorldForbiddenError(
                f"MakerWorld rechazó el acceso a {path} — puede requerir compra, puntos o estar restringido por región"
            )
        if response.status_code == 404:
            raise MakerWorldNotFoundError(f"Recurso de MakerWorld no encontrado: {path}")
        if response.status_code == 418 or response.status_code == 429:
            raise MakerWorldUnavailableError(
                "MakerWorld bloqueó la petición temporalmente (anti-abuso). Reintentá en unos minutos."
            )
        if response.status_code >= 500:
            raise MakerWorldUnavailableError(f"MakerWorld devolvió error de servidor ({response.status_code})")
        if response.status_code != 200:
            raise MakerWorldUnavailableError(f"Status inesperado de MakerWorld: {response.status_code}")
        try:
            data = response.json()
        except ValueError as exc:
            raise MakerWorldUnavailableError("MakerWorld devolvió una respuesta no-JSON") from exc
        if not isinstance(data, dict):
            raise MakerWorldUnavailableError("MakerWorld devolvió un JSON con forma inesperada")
        return data

    async def get_design(self, design_id: int) -> dict:
        """Metadata completa del diseño. Funciona sin autenticar."""
        return await self._get_json(f"/design/{int(design_id)}")

    async def get_design_instances(self, design_id: int) -> dict:
        """`{"total": N, "hits": [{id, profileId, title, cover, ...}]}`. Funciona sin autenticar."""
        return await self._get_json(f"/design/{int(design_id)}/instances")

    async def get_profile_download(self, profile_id: int, alphanumeric_model_id: str) -> dict:
        """
        Obtiene la URL firmada de descarga del `.3mf` de una instancia.

        Requiere login. `alphanumeric_model_id` es el campo `modelId` de
        `get_design` (NO el `design_id` numérico de la URL) — endpoint
        reverse-engineered por la comunidad, vive en `iot-service` (no
        detrás del Cloudflare de makerworld.com).
        """
        if not self._auth_token:
            raise MakerWorldAuthError("Descargar de MakerWorld requiere iniciar sesión con Bambu Cloud")
        url = f"https://api.bambulab.com/v1/iot-service/api/user/profile/{int(profile_id)}"
        try:
            response = await self._client.get(
                url, headers=self._headers(), params={"model_id": alphanumeric_model_id}, timeout=30.0
            )
        except httpx.HTTPError as exc:
            raise MakerWorldUnavailableError(f"Petición de descarga falló: {exc}") from exc

        if response.status_code == 401:
            raise MakerWorldAuthError("Bambu Cloud rechazó el token — iniciá sesión de nuevo en Settings → Integraciones")
        if response.status_code == 403:
            raise MakerWorldForbiddenError(f"Bambu Lab rechazó el acceso al perfil {profile_id}")
        if response.status_code == 404:
            raise MakerWorldNotFoundError(f"Perfil de MakerWorld no encontrado: {profile_id}")
        if response.status_code != 200:
            raise MakerWorldUnavailableError(f"Status inesperado ({response.status_code}) al pedir descarga")
        try:
            return response.json()
        except ValueError as exc:
            raise MakerWorldUnavailableError("Respuesta de descarga no-JSON") from exc

    async def download_3mf(self, signed_url: str) -> tuple[bytes, str]:
        """Descarga los bytes del `.3mf` desde la URL firmada. SSRF guard: solo hosts conocidos."""
        parsed = urlparse(signed_url)
        host = (parsed.hostname or "").lower()
        allowed = host in MAKERWORLD_CDN_HOSTS or any(host.endswith(s) for s in _ALLOWED_DOWNLOAD_SUFFIXES)
        if not allowed:
            raise MakerWorldUrlError(f"Host de descarga no permitido: {host!r}")
        filename = parsed.path.rsplit("/", 1)[-1] or "model.3mf"

        cdn_headers = {"User-Agent": _USER_AGENT}
        try:
            async with self._client.stream("GET", signed_url, headers=cdn_headers, timeout=60.0, follow_redirects=False) as response:
                if response.status_code != 200:
                    raise MakerWorldUnavailableError(f"Descarga del .3mf devolvió HTTP {response.status_code}")
                chunks = []
                total = 0
                async for chunk in response.aiter_bytes():
                    total += len(chunk)
                    if total > _MAX_3MF_BYTES:
                        raise MakerWorldUnavailableError(f"El .3mf supera el límite de {_MAX_3MF_BYTES // (1024*1024)} MB")
                    chunks.append(chunk)
                return b"".join(chunks), filename
        except httpx.HTTPError as exc:
            raise MakerWorldUnavailableError(f"Descarga del .3mf falló: {exc}") from exc

    async def fetch_thumbnail(self, url: str) -> tuple[bytes, str]:
        """
        Proxy de imagen del CDN de MakerWorld — SSRF guard con allowlist de
        host EXACTO. La URL saliente se reconstruye desde cero a partir de
        `scheme` fijo ("https") + el host ya validado + path/query — nunca
        se reenvía el string crudo recibido del caller, así ni un truco de
        userinfo (`https://makerworld.bblmw.com@evil.com/`) ni de parsing
        puede colar un host distinto al validado.
        """
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        if parsed.scheme not in ("http", "https") or host not in MAKERWORLD_CDN_HOSTS:
            raise MakerWorldUrlError(f"Host de thumbnail no permitido: {host!r}")
        safe_url = urlunparse(("https", host, parsed.path, "", parsed.query, ""))
        try:
            response = await self._client.get(safe_url, headers=self._headers(), timeout=20.0, follow_redirects=False)
        except httpx.HTTPError as exc:
            raise MakerWorldUnavailableError(f"Petición de thumbnail falló: {exc}") from exc
        if response.status_code != 200:
            raise MakerWorldUnavailableError(f"Thumbnail devolvió HTTP {response.status_code}")
        content_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip() or "image/jpeg"
        return response.content, content_type


# ─── Orquestación (construye ModelFile) ────────────────────────────────────

_RATE_LIMIT_SEMAPHORE = asyncio.Semaphore(2)


async def _get_or_create_makerworld_folder(db: AsyncSession) -> int:
    """Carpeta raíz "MakerWorld", creada perezosamente en el primer import."""
    result = await db.execute(
        select(VaultFolder).where(VaultFolder.name == "MakerWorld", VaultFolder.parent_id.is_(None))
    )
    folder = result.scalar_one_or_none()
    if folder is None:
        folder = VaultFolder(name="MakerWorld", parent_id=None)
        db.add(folder)
        await db.flush()
    return folder.id


def _canonical_source_url(design_id: int, profile_id: Optional[int]) -> str:
    if profile_id:
        return f"https://makerworld.com/models/{design_id}#profileId-{profile_id}"
    return f"https://makerworld.com/models/{design_id}"


async def import_instance(
    db: AsyncSession,
    client: MakerWorldClient,
    design_id: int,
    profile_id: Optional[int],
    folder_id: Optional[int],
    uploaded_by: Optional[int] = None,
    author_name: Optional[str] = None,
) -> tuple[ModelFile, bool]:
    """
    Descarga una instancia y la guarda en el Vault (slot `source_file`).

    Dedupe por `source_url` canónico (design_id + profile_id) — si ya se
    importó esta instancia, retorna el `ModelFile` existente sin
    re-descargar. Retorna `(model_file, was_existing)`.
    """
    design = await client.get_design(design_id)
    alphanumeric_model_id = design.get("modelId")
    if not isinstance(alphanumeric_model_id, str) or not alphanumeric_model_id:
        raise MakerWorldUnavailableError("La metadata del diseño no trae 'modelId'")

    if profile_id is None:
        for instance in design.get("instances") or []:
            pid = instance.get("profileId")
            if isinstance(pid, int) and pid > 0:
                profile_id = pid
                break
        if profile_id is None:
            envelope = await client.get_design_instances(design_id)
            for hit in envelope.get("hits") or []:
                pid = hit.get("profileId")
                if isinstance(pid, int) and pid > 0:
                    profile_id = pid
                    break
        if profile_id is None:
            raise MakerWorldUnavailableError("MakerWorld no devolvió instancias para este diseño")

    source_url = _canonical_source_url(design_id, profile_id)
    existing = await db.execute(select(ModelFile).where(ModelFile.source_url == source_url).limit(1))
    existing_model = existing.scalar_one_or_none()
    if existing_model is not None:
        return existing_model, True

    async with _RATE_LIMIT_SEMAPHORE:
        manifest = await client.get_profile_download(profile_id, alphanumeric_model_id)
        signed_url = manifest.get("url")
        if not signed_url or not isinstance(signed_url, str):
            raise MakerWorldUnavailableError("MakerWorld no devolvió una URL de descarga")
        file_bytes, download_filename = await client.download_3mf(signed_url)

    title = design.get("title") or f"MakerWorld {design_id}"
    filename = f"{title}.3mf" if not download_filename.endswith(".3mf") else download_filename
    filename = filename.replace("/", "_")

    effective_folder_id = folder_id if folder_id is not None else await _get_or_create_makerworld_folder(db)

    source_key = f"{uuid.uuid4()}-{filename.replace(' ', '_')}"
    await upload_file(source_key, file_bytes, content_type=_source_content_type(filename))

    model = ModelFile(
        uploaded_by=uploaded_by,
        source_file_key=source_key,
        source_file_name=filename,
        source_file_size=len(file_bytes),
        name=title,
        description=design.get("summary"),
        source_url=source_url,
        source_platform="makerworld",
        creator_name=author_name or (design.get("designCreator") or {}).get("name"),
        creator_url=None,
        folder_id=effective_folder_id,
    )
    db.add(model)
    await db.commit()
    await db.refresh(model)

    try:
        await _persist_plates_from_print_file(db, model, file_bytes)
    except Exception as exc:
        logger.warning("No se pudieron parsear plates del .3mf de MakerWorld %s: %s", design_id, exc)

    if not model.plates:
        png = await _extract_source_thumbnail_png(file_bytes, filename)
        if png:
            try:
                model.thumbnail_key = await save_thumbnail(model.id, png)
            except Exception as exc:
                logger.warning("No se pudo guardar thumbnail de MakerWorld %s: %s", design_id, exc)

    await db.commit()
    db.add(MakerworldImport(design_id=design_id, profile_id=profile_id, title=title, model_file_id=model.id))
    await db.commit()

    return model, False
