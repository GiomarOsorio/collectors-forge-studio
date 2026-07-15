"""
Modelo ORM para la tabla de configuración de la aplicación por usuario.

Define la entidad AppSettings que almacena los parámetros globales que influyen
en el cálculo de costos: tarifa eléctrica, tasa de fallos, costo de mano de
obra y margen de ganancia por defecto. Cada usuario tiene exactamente una fila
en esta tabla (relación uno-a-uno con users).
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, ForeignKey, Numeric, String, CheckConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AppSettings(Base):
    """
    Modelo de base de datos para la configuración de la aplicación por usuario.

    Atributos:
        id: Clave primaria autoincremental.
        user_id: Clave foránea hacia users. Restricción UNIQUE (una fila por usuario).
        electricity_rate: Tarifa eléctrica en USD/kWh. Numeric(12,6).
        failure_rate_percent: Porcentaje de fallos (0–100). Numeric(7,4).
        labor_cost_per_hour: Costo de mano de obra por hora en USD. Numeric(12,4).
        default_margin_percent: Margen por defecto (0–100). Numeric(7,4).
        currency: Código ISO de moneda. Ej: "USD".
        spool_low_stock_threshold_g: Umbral (gramos) para alertar bobinas
            bajas por tipo de filamento (issue #134). Numeric(8,1).
        smtp_host/port/user/password/from_email/tls: Configuración del
            servidor SMTP del estudio (issue #137) — un solo servidor, no
            por canal; el canal 'email' solo lleva la lista de destinatarios.
        quiet_hours_start/end: Rango "HH:MM" (America/Bogota) en el que los
            eventos se suprimen o difieren al digest (issue #137). NULL en
            cualquiera de los dos = quiet hours deshabilitado.
        digest_hour: Hora (0-23, America/Bogota) del digest diario. NULL =
            digest deshabilitado (los eventos en quiet hours sin
            defer_to_digest se descartan).
        updated_at: Timestamp UTC de la última modificación.
    """

    __tablename__ = "app_settings"
    __table_args__ = (
        CheckConstraint("electricity_rate >= 0",                                        name="ck_settings_rate_ge0"),
        CheckConstraint("failure_rate_percent >= 0 AND failure_rate_percent <= 100",    name="ck_settings_failure_range"),
        CheckConstraint("labor_cost_per_hour >= 0",                                     name="ck_settings_labor_ge0"),
        CheckConstraint("default_margin_percent >= 0 AND default_margin_percent <= 100", name="ck_settings_margin_range"),
        CheckConstraint("spool_low_stock_threshold_g >= 0",                              name="ck_settings_spool_threshold_ge0"),
        CheckConstraint("digest_hour IS NULL OR (digest_hour >= 0 AND digest_hour <= 23)", name="ck_settings_digest_hour_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # user_id se mantiene por auditoría (quién creó/modificó)
    user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    electricity_rate: Mapped[Decimal] = mapped_column(
        Numeric(12, 6), server_default=text("0.150000")
    )
    failure_rate_percent: Mapped[Decimal] = mapped_column(
        Numeric(7, 4), server_default=text("5.0000")
    )
    labor_cost_per_hour: Mapped[Decimal] = mapped_column(
        Numeric(12, 4), server_default=text("10.0000")
    )
    default_margin_percent: Mapped[Decimal] = mapped_column(
        Numeric(7, 4), server_default=text("30.0000")
    )
    currency: Mapped[str] = mapped_column(server_default=text("'USD'"))
    spool_low_stock_threshold_g: Mapped[Decimal] = mapped_column(
        Numeric(8, 1), server_default=text("200.0")
    )
    # SMTP del estudio (issue #137) — un solo servidor, no por canal.
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    smtp_user: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_from: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    smtp_tls: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))
    # Quiet hours + digest (issue #137)
    quiet_hours_start: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    quiet_hours_end: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    digest_hour: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
