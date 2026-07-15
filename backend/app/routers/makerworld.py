"""
Router de integración MakerWorld + Bambu Cloud (issue #139).

Endpoints:
    GET    /api/makerworld/auth/status    — Estado de la sesión Bambu Cloud.
    POST   /api/makerworld/auth/login     — Inicia login (dispara verificación).
    POST   /api/makerworld/auth/verify    — Completa login (código email o TOTP).
    DELETE /api/makerworld/auth           — Cierra sesión (borra tokens).
    POST   /api/makerworld/resolve        — URL → metadata + instancias.
    POST   /api/makerworld/import         — Descarga una instancia al Vault.
    POST   /api/makerworld/import-all     — Descarga todas las instancias.
    GET    /api/makerworld/recent         — Últimos 10 imports.
    GET    /api/makerworld/thumbnail      — Proxy de imagen del CDN de MakerWorld.

`resolve`/`recent`/`thumbnail` funcionan para cualquier usuario autenticado
(metadata pública). `import`/`import-all`/`auth/*` requieren admin.
"""

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.bambu_cloud_auth import BambuCloudAuth
from app.models.makerworld_import import MakerworldImport
from app.models.model_file import ModelFile
from app.models.user import User
from app.schemas.makerworld import (
    CloudAuthStatus,
    CloudLoginRequest,
    CloudLoginResponse,
    CloudVerifyRequest,
    MakerWorldImportAllRequest,
    MakerWorldImportAllResponse,
    MakerWorldImportAllResult,
    MakerWorldImportRequest,
    MakerWorldImportResponse,
    MakerWorldInstance,
    MakerWorldRecentImport,
    MakerWorldResolveRequest,
    MakerWorldResolveResponse,
)
from app.services.auth import get_admin_user, get_current_user
from app.services.bambu_cloud import BambuCloudAuthError, BambuCloudError, BambuCloudService
from app.services.makerworld_import import (
    MakerWorldAuthError,
    MakerWorldClient,
    MakerWorldError,
    MakerWorldForbiddenError,
    MakerWorldNotFoundError,
    MakerWorldUnavailableError,
    MakerWorldUrlError,
    import_instance,
    parse_makerworld_url,
)

router = APIRouter(prefix="/api/makerworld", tags=["makerworld"])


def _map_error(exc: MakerWorldError) -> HTTPException:
    if isinstance(exc, MakerWorldUrlError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, MakerWorldAuthError):
        return HTTPException(status_code=409, detail=str(exc))
    if isinstance(exc, MakerWorldForbiddenError):
        return HTTPException(status_code=403, detail=str(exc))
    if isinstance(exc, MakerWorldNotFoundError):
        return HTTPException(status_code=404, detail=str(exc))
    if isinstance(exc, MakerWorldUnavailableError):
        return HTTPException(status_code=502, detail=str(exc))
    return HTTPException(status_code=500, detail=f"Error de MakerWorld: {exc}")


async def _get_auth(db: AsyncSession) -> Optional[BambuCloudAuth]:
    result = await db.execute(select(BambuCloudAuth).limit(1))
    return result.scalar_one_or_none()


def _mask_email(email: Optional[str]) -> Optional[str]:
    if not email or "@" not in email:
        return email
    user, domain = email.split("@", 1)
    masked = user[0] + "***" if len(user) > 1 else "*"
    return f"{masked}@{domain}"


# ─── Auth Bambu Cloud ───────────────────────────────────────────────────────

@router.get("/auth/status", response_model=CloudAuthStatus)
async def auth_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    auth = await _get_auth(db)
    if not auth or not auth.access_token:
        return CloudAuthStatus(configured=False)
    return CloudAuthStatus(
        configured=True, email_masked=_mask_email(auth.email), expires_at=auth.token_expires_at,
    )


@router.post("/auth/login", response_model=CloudLoginResponse)
async def auth_login(
    data: CloudLoginRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    cloud = BambuCloudService()
    try:
        result = await cloud.login_request(data.email, data.password)
        if result.get("success") and cloud.access_token:
            await _store_tokens(db, cloud, data.email)
            return CloudLoginResponse(status="ok", message=result["message"])
        if result.get("needs_verification"):
            vtype = result.get("verification_type")
            return CloudLoginResponse(
                status="tfa" if vtype == "totp" else "verify_code",
                message=result["message"],
                tfa_key=result.get("tfa_key"),
            )
        raise HTTPException(status_code=401, detail=result.get("message", "Login falló"))
    except BambuCloudAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except BambuCloudError as e:
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        await cloud.close()


@router.post("/auth/verify", response_model=CloudLoginResponse)
async def auth_verify(
    data: CloudVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    auth = await _get_auth(db)
    email = auth.email if auth else None
    cloud = BambuCloudService()
    try:
        if data.tfa_key:
            result = await cloud.verify_totp(data.tfa_key, data.code)
        else:
            if not email:
                raise HTTPException(status_code=400, detail="No hay un login en curso — iniciá sesión primero")
            result = await cloud.verify_code(email, data.code)

        if result.get("success") and cloud.access_token:
            await _store_tokens(db, cloud, email or "")
            return CloudLoginResponse(status="ok", message=result["message"])
        raise HTTPException(status_code=401, detail=result.get("message", "Verificación fallida"))
    except BambuCloudAuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except BambuCloudError as e:
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        await cloud.close()


async def _store_tokens(db: AsyncSession, cloud: BambuCloudService, email: str) -> None:
    auth = await _get_auth(db)
    if auth is None:
        auth = BambuCloudAuth()
        db.add(auth)
    auth.email = email
    auth.access_token = cloud.access_token
    auth.refresh_token = cloud.refresh_token
    auth.token_expires_at = cloud.token_expiry
    await db.commit()


@router.delete("/auth", status_code=status.HTTP_204_NO_CONTENT)
async def auth_logout(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    auth = await _get_auth(db)
    if auth is not None:
        await db.delete(auth)
        await db.commit()


# ─── Resolve / Import ───────────────────────────────────────────────────────

@router.post("/resolve", response_model=MakerWorldResolveResponse)
async def resolve(
    data: MakerWorldResolveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        design_id = parse_makerworld_url(data.url)
    except MakerWorldError as exc:
        raise _map_error(exc)

    auth = await _get_auth(db)
    client = MakerWorldClient(auth_token=auth.access_token if auth else None)
    try:
        design = await client.get_design(design_id)
        envelope = await client.get_design_instances(design_id)
    except MakerWorldError as exc:
        raise _map_error(exc)
    finally:
        await client.close()

    instances_raw = envelope.get("hits") or []
    instances = [
        MakerWorldInstance(
            id=inst.get("id"), profile_id=inst.get("profileId"),
            title=inst.get("title"), thumbnail=inst.get("cover"),
        )
        for inst in instances_raw if isinstance(inst, dict)
    ]
    images = [design.get("coverUrl")] if design.get("coverUrl") else []
    for img in (design.get("images") or []):
        if isinstance(img, str):
            images.append(img)
        elif isinstance(img, dict) and img.get("url"):
            images.append(img["url"])

    prefix = f"https://makerworld.com/models/{design_id}"
    existing_q = await db.execute(
        select(MakerworldImport.model_file_id).where(
            MakerworldImport.design_id == design_id,
            MakerworldImport.model_file_id.is_not(None),
        )
    )
    already_imported = [row[0] for row in existing_q.all()]

    return MakerWorldResolveResponse(
        design_id=design_id,
        title=design.get("title") or f"MakerWorld {design_id}",
        author=(design.get("designCreator") or {}).get("name"),
        images=images,
        instances=instances,
        already_imported_model_ids=already_imported,
    )


@router.post("/import", response_model=MakerWorldImportResponse)
async def import_one(
    data: MakerWorldImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    auth = await _get_auth(db)
    if not auth or not auth.access_token:
        raise HTTPException(
            status_code=409,
            detail="Configurá tu cuenta de Bambu Cloud en Settings → Integraciones antes de importar",
        )

    client = MakerWorldClient(auth_token=auth.access_token)
    try:
        model, was_existing = await import_instance(
            db, client, data.design_id, data.profile_id, data.folder_id,
            uploaded_by=current_user.id,
        )
    except MakerWorldError as exc:
        raise _map_error(exc)
    finally:
        await client.close()

    return MakerWorldImportResponse(
        model_file_id=model.id, name=model.name, folder_id=model.folder_id,
        profile_id=data.profile_id, was_existing=was_existing,
    )


@router.post("/import-all", response_model=MakerWorldImportAllResponse)
async def import_all(
    data: MakerWorldImportAllRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Importa TODAS las instancias del diseño, secuencialmente (con rate limit)."""
    auth = await _get_auth(db)
    if not auth or not auth.access_token:
        raise HTTPException(
            status_code=409,
            detail="Configurá tu cuenta de Bambu Cloud en Settings → Integraciones antes de importar",
        )

    client = MakerWorldClient(auth_token=auth.access_token)
    try:
        envelope = await client.get_design_instances(data.design_id)
    except MakerWorldError as exc:
        await client.close()
        raise _map_error(exc)

    profile_ids = [
        hit.get("profileId") for hit in (envelope.get("hits") or [])
        if isinstance(hit.get("profileId"), int)
    ]
    if not profile_ids:
        await client.close()
        raise HTTPException(status_code=502, detail="MakerWorld no devolvió instancias para este diseño")

    imported: List[MakerWorldImportAllResult] = []
    failed: List[MakerWorldImportAllResult] = []
    for idx, pid in enumerate(profile_ids):
        try:
            model, _was_existing = await import_instance(
                db, client, data.design_id, pid, data.folder_id, uploaded_by=current_user.id,
            )
            imported.append(MakerWorldImportAllResult(profile_id=pid, ok=True, model_file_id=model.id))
        except MakerWorldError as exc:
            failed.append(MakerWorldImportAllResult(profile_id=pid, ok=False, error=str(exc)))
        if idx < len(profile_ids) - 1:
            await asyncio.sleep(1)

    await client.close()
    return MakerWorldImportAllResponse(imported=imported, failed=failed)


@router.get("/recent", response_model=List[MakerWorldRecentImport])
async def recent_imports(
    limit: int = Query(default=10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MakerworldImport).order_by(MakerworldImport.created_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/thumbnail")
async def proxy_thumbnail(url: str = Query(...)):
    """
    Proxy de imagen del CDN de MakerWorld — el `<img>` del frontend no puede
    hotlinkear directo (CSP `img-src`) ni mandar el header Authorization,
    así que este endpoint es **deliberadamente público** (mismo criterio que
    el proxy de portada de proyectos, issue #136) — exigir auth rompería
    cada `<img>` con un 401 silencioso. Las imágenes proxeadas son del CDN
    *público* de MakerWorld (cualquier visitante de makerworld.com las ve
    sin login), así que no se expone nada sensible. SSRF guard: solo hosts
    del CDN de MakerWorld (ver `fetch_thumbnail`) evita que esto se abuse
    como proxy abierto genérico.
    """
    client = MakerWorldClient()
    try:
        payload, content_type = await client.fetch_thumbnail(url)
    except MakerWorldError as exc:
        raise _map_error(exc)
    finally:
        await client.close()
    return Response(content=payload, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
