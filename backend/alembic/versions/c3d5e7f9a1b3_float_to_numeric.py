"""Float a NUMERIC en todas las columnas financieras

Revision ID: c3d5e7f9a1b3
Revises: a3f8d2c19b47
Create Date: 2026-02-19 12:00:00.000000

Convierte TODAS las columnas FLOAT8/double precision a NUMERIC(precision,scale)
en las tablas financieras del sistema.

Criterio de precisión:
  - Dinero          → Numeric(12,4)
  - Porcentaje      → Numeric(7,4)   [0–100 con 4 decimales; 7 dígitos totales]
  - Horas / medidas → Numeric(10,2)
  - Gramos          → Numeric(10,3)
  - Tasas pequeñas  → Numeric(12,6)
  - COP (enteros)   → Numeric(16,0)

No crea tablas nuevas.
No elimina columnas.
No modifica nullable.
Es reversible via downgrade.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c3d5e7f9a1b3"
down_revision: Union[str, None] = "a3f8d2c19b47"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _up(table: str, col: str, prec: int, scale: int) -> None:
    """FLOAT8 → NUMERIC(prec, scale)."""
    op.alter_column(
        table,
        col,
        existing_type=sa.Float(),
        type_=sa.Numeric(prec, scale),
        postgresql_using=f"ROUND({col}::numeric, {scale})",
    )


def _down(table: str, col: str, prec: int, scale: int) -> None:
    """NUMERIC(prec, scale) → FLOAT8."""
    op.alter_column(
        table,
        col,
        existing_type=sa.Numeric(prec, scale),
        type_=sa.Float(),
        postgresql_using=f"{col}::float",
    )


# ---------------------------------------------------------------------------
# upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:

    # ── filaments ─────────────────────────────────────────────────────────
    _up("filaments", "price_per_kg",    12, 4)
    _up("filaments", "weight_per_roll", 10, 3)
    _up("filaments", "diameter",         6, 3)
    _up("filaments", "density",          8, 6)

    # ── printers ──────────────────────────────────────────────────────────
    _up("printers", "purchase_price",             12, 4)
    _up("printers", "power_consumption_watts",    10, 2)
    _up("printers", "estimated_lifespan_hours",   10, 2)
    _up("printers", "current_hours",              10, 2)
    _up("printers", "nozzle_price",               12, 4)
    _up("printers", "nozzle_lifespan_hours",      10, 2)
    _up("printers", "buildplate_price",           12, 4)
    _up("printers", "buildplate_lifespan_hours",  10, 2)
    _up("printers", "other_maintenance_per_hour", 12, 6)

    # ── app_settings ──────────────────────────────────────────────────────
    _up("app_settings", "electricity_rate",       12, 6)
    _up("app_settings", "failure_rate_percent",    7, 4)
    _up("app_settings", "labor_cost_per_hour",    12, 4)
    _up("app_settings", "default_margin_percent",  7, 4)

    # ── supplies ──────────────────────────────────────────────────────────
    _up("supplies", "price_per_unit", 12, 4)
    _up("supplies", "pack_price",     12, 4)

    # ── electricity_tariffs ───────────────────────────────────────────────
    _up("electricity_tariffs", "cop_market_rate", 14, 4)
    _up("electricity_tariffs", "cop_rate_used",   14, 4)
    _up("electricity_tariffs", "usd_rate",        12, 6)
    _up("electricity_tariffs", "usd_to_cop",      10, 2)
    _up("electricity_tariffs", "multiplier",       5, 2)

    # ── quotes ────────────────────────────────────────────────────────────
    _up("quotes", "weight_grams",               10, 3)
    _up("quotes", "print_time_hours",           10, 2)
    _up("quotes", "preparation_time_hours",     10, 2)
    _up("quotes", "post_processing_time_hours", 10, 2)
    _up("quotes", "material_cost",              12, 4)
    _up("quotes", "electricity_cost",           12, 4)
    _up("quotes", "depreciation_cost",          12, 4)
    _up("quotes", "maintenance_cost",           12, 4)
    _up("quotes", "labor_cost",                 12, 4)
    _up("quotes", "failure_cost",               12, 4)
    _up("quotes", "subtotal",                   12, 4)
    _up("quotes", "margin_percent",              7, 4)
    _up("quotes", "margin_amount",              12, 4)
    _up("quotes", "total_per_unit",             12, 4)
    _up("quotes", "total_price",                12, 4)
    _up("quotes", "supplies_cost",              12, 4)
    _up("quotes", "usd_to_cop_rate",            10, 2)
    _up("quotes", "total_per_unit_cop",         16, 0)
    _up("quotes", "total_price_cop",            16, 0)

    # ── CheckConstraints ──────────────────────────────────────────────────
    op.create_check_constraint(
        "ck_printers_lifespan_pos",  "printers",
        "estimated_lifespan_hours > 0",
    )
    op.create_check_constraint(
        "ck_printers_nozzle_pos",    "printers",
        "nozzle_lifespan_hours > 0",
    )
    op.create_check_constraint(
        "ck_printers_plate_pos",     "printers",
        "buildplate_lifespan_hours > 0",
    )
    op.create_check_constraint(
        "ck_printers_purchase_ge0",  "printers",
        "purchase_price >= 0",
    )
    op.create_check_constraint(
        "ck_settings_rate_ge0",      "app_settings",
        "electricity_rate >= 0",
    )
    op.create_check_constraint(
        "ck_settings_failure_range", "app_settings",
        "failure_rate_percent >= 0 AND failure_rate_percent <= 100",
    )
    op.create_check_constraint(
        "ck_settings_labor_ge0",     "app_settings",
        "labor_cost_per_hour >= 0",
    )
    op.create_check_constraint(
        "ck_settings_margin_range",  "app_settings",
        "default_margin_percent >= 0 AND default_margin_percent <= 100",
    )
    op.create_check_constraint(
        "ck_supplies_price_ge0",     "supplies",
        "price_per_unit >= 0",
    )
    op.create_check_constraint(
        "ck_quotes_margin_range",    "quotes",
        "margin_percent >= 0 AND margin_percent <= 100",
    )


# ---------------------------------------------------------------------------
# downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    # Eliminar constraints primero
    for name, table in [
        ("ck_quotes_margin_range",    "quotes"),
        ("ck_supplies_price_ge0",     "supplies"),
        ("ck_settings_margin_range",  "app_settings"),
        ("ck_settings_labor_ge0",     "app_settings"),
        ("ck_settings_failure_range", "app_settings"),
        ("ck_settings_rate_ge0",      "app_settings"),
        ("ck_printers_purchase_ge0",  "printers"),
        ("ck_printers_plate_pos",     "printers"),
        ("ck_printers_nozzle_pos",    "printers"),
        ("ck_printers_lifespan_pos",  "printers"),
    ]:
        op.drop_constraint(name, table, type_="check")

    # Revertir tipos — orden inverso al upgrade
    _down("quotes", "total_price_cop",            16, 0)
    _down("quotes", "total_per_unit_cop",         16, 0)
    _down("quotes", "usd_to_cop_rate",            10, 2)
    _down("quotes", "supplies_cost",              12, 4)
    _down("quotes", "total_price",                12, 4)
    _down("quotes", "total_per_unit",             12, 4)
    _down("quotes", "margin_amount",              12, 4)
    _down("quotes", "margin_percent",              7, 4)
    _down("quotes", "subtotal",                   12, 4)
    _down("quotes", "failure_cost",               12, 4)
    _down("quotes", "labor_cost",                 12, 4)
    _down("quotes", "maintenance_cost",           12, 4)
    _down("quotes", "depreciation_cost",          12, 4)
    _down("quotes", "electricity_cost",           12, 4)
    _down("quotes", "material_cost",              12, 4)
    _down("quotes", "post_processing_time_hours", 10, 2)
    _down("quotes", "preparation_time_hours",     10, 2)
    _down("quotes", "print_time_hours",           10, 2)
    _down("quotes", "weight_grams",               10, 3)

    _down("electricity_tariffs", "multiplier",       5, 2)
    _down("electricity_tariffs", "usd_to_cop",      10, 2)
    _down("electricity_tariffs", "usd_rate",        12, 6)
    _down("electricity_tariffs", "cop_rate_used",   14, 4)
    _down("electricity_tariffs", "cop_market_rate", 14, 4)

    _down("supplies", "pack_price",     12, 4)
    _down("supplies", "price_per_unit", 12, 4)

    _down("app_settings", "default_margin_percent",  7, 4)
    _down("app_settings", "labor_cost_per_hour",    12, 4)
    _down("app_settings", "failure_rate_percent",    7, 4)
    _down("app_settings", "electricity_rate",       12, 6)

    _down("printers", "other_maintenance_per_hour", 12, 6)
    _down("printers", "buildplate_lifespan_hours",  10, 2)
    _down("printers", "buildplate_price",           12, 4)
    _down("printers", "nozzle_lifespan_hours",      10, 2)
    _down("printers", "nozzle_price",               12, 4)
    _down("printers", "current_hours",              10, 2)
    _down("printers", "estimated_lifespan_hours",   10, 2)
    _down("printers", "power_consumption_watts",    10, 2)
    _down("printers", "purchase_price",             12, 4)

    _down("filaments", "density",          8, 6)
    _down("filaments", "diameter",         6, 3)
    _down("filaments", "weight_per_roll",  10, 3)
    _down("filaments", "price_per_kg",     12, 4)
