"""
Modelo ORM para las credenciales de Bambu Cloud (issue #139).

Adaptado de bambuddy (https://github.com/maziggy/bambuddy), AGPL-3.0 — solo
el concepto de token de sesión persistido; el modelo es propio de CFS
(singleton de un solo estudio, sin multi-tenancy por usuario).
"""

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import DateTime, Integer, String

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BambuCloudAuth(Base):
    """
    Credenciales de sesión de Bambu Cloud del estudio (singleton, `LIMIT 1`).

    **Password NUNCA se guarda** — solo se usa en memoria durante el flujo
    de login (`login_request`/`verify_code`/`verify_totp`) y se descarta.
    `access_token` en texto plano — mismo criterio consciente que
    `NotificationChannel.config` (issue #137): CFS no tiene cifrado en
    reposo, BD privada del estudio.

    Región fija 'global' (`api.bambulab.com`) — la región China de bambuddy
    está fuera de alcance (issue #139, ver doc).

    Atributos:
        id:                PK autoincremental.
        email:              Email de la cuenta Bambu conectada.
        access_token:       Bearer token de Bambu Cloud.
        refresh_token:      Token de refresco (si Bambu lo emite).
        token_expires_at:   Expiración estimada (Bambu no siempre la declara
                             explícito; se asume ~30 días desde el login,
                             igual que bambuddy).
        updated_at:         Timestamp UTC de la última actualización.
    """

    __tablename__ = "bambu_cloud_auth"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    token_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
