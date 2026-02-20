"""Agregar multi-tenant: tabla companies y company_id en todas las tablas

Revision ID: f4a1b9c2d8e7
Revises: c3d5e7f9a1b3
Create Date: 2026-02-19 18:00:00.000000

Crea la tabla companies y agrega la columna company_id a todas las tablas
de negocio: users, filaments, printers, supplies, quotes, app_settings.

Pasos:
  1. Crear tabla companies con UUID PK.
  2. Insertar empresa por defecto (UUID fijo y reproducible).
  3. Agregar company_id nullable a cada tabla + FK + índice.
  4. Rellenar company_id en todos los registros existentes.
  5. Para app_settings: eliminar UNIQUE en user_id, hacer user_id nullable,
     agregar UNIQUE en company_id.

El downgrade elimina las columnas y la tabla, dejando todo como estaba.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "f4a1b9c2d8e7"
down_revision: Union[str, None] = "c3d5e7f9a1b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# UUID de la empresa por defecto — fijo y reproducible en todas las instalaciones
DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    # ── 1. Tabla companies ────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    # ── 2. Empresa por defecto ────────────────────────────────────────────
    op.execute(
        f"INSERT INTO companies (id, name, created_at, updated_at) "
        f"VALUES ('{DEFAULT_COMPANY_ID}', 'Calculator3D', NOW(), NOW())"
    )

    # ── 3-4. users ────────────────────────────────────────────────────────
    op.add_column(
        "users",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_users_company_id", "users", "companies", ["company_id"], ["id"]
    )
    op.execute(f"UPDATE users SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_index("ix_users_company_id", "users", ["company_id"])

    # ── 3-4. filaments ────────────────────────────────────────────────────
    op.add_column(
        "filaments",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_filaments_company_id", "filaments", "companies", ["company_id"], ["id"]
    )
    op.execute(f"UPDATE filaments SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_index("ix_filaments_company_id", "filaments", ["company_id"])

    # ── 3-4. printers ─────────────────────────────────────────────────────
    op.add_column(
        "printers",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_printers_company_id", "printers", "companies", ["company_id"], ["id"]
    )
    op.execute(f"UPDATE printers SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_index("ix_printers_company_id", "printers", ["company_id"])

    # ── 3-4. supplies ─────────────────────────────────────────────────────
    op.add_column(
        "supplies",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_supplies_company_id", "supplies", "companies", ["company_id"], ["id"]
    )
    op.execute(f"UPDATE supplies SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_index("ix_supplies_company_id", "supplies", ["company_id"])

    # ── 3-4. quotes ───────────────────────────────────────────────────────
    op.add_column(
        "quotes",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quotes_company_id", "quotes", "companies", ["company_id"], ["id"]
    )
    # Las cotizaciones heredan el company_id del usuario que las creó
    op.execute(
        f"UPDATE quotes q SET company_id = u.company_id "
        f"FROM users u WHERE q.user_id = u.id"
    )
    # Fallback para cotizaciones sin usuario válido (no debería ocurrir)
    op.execute(
        f"UPDATE quotes SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL"
    )
    op.create_index("ix_quotes_company_id", "quotes", ["company_id"])

    # ── 5. app_settings — migración más compleja ───────────────────────────
    # Eliminar UNIQUE en user_id (la configuración pasa a ser por empresa)
    op.drop_constraint("app_settings_user_id_key", "app_settings", type_="unique")
    # Hacer user_id nullable (queda como referencia de auditoría)
    op.alter_column("app_settings", "user_id", existing_type=sa.Integer(), nullable=True)
    # Agregar company_id
    op.add_column(
        "app_settings",
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_app_settings_company_id", "app_settings", "companies", ["company_id"], ["id"]
    )
    # Derivar company_id desde el usuario propietario de la configuración
    op.execute(
        "UPDATE app_settings s SET company_id = u.company_id "
        "FROM users u WHERE s.user_id = u.id"
    )
    op.execute(
        f"UPDATE app_settings SET company_id = '{DEFAULT_COMPANY_ID}' WHERE company_id IS NULL"
    )
    # Deduplicar: si hay varias filas con el mismo company_id (situación normal
    # cuando existía una configuración por usuario), conservar solo la de menor id.
    op.execute(
        "DELETE FROM app_settings "
        "WHERE id NOT IN ("
        "  SELECT MIN(id) FROM app_settings GROUP BY company_id"
        ")"
    )
    # Una sola configuración por empresa
    op.create_unique_constraint("uq_app_settings_company_id", "app_settings", ["company_id"])
    op.create_index("ix_app_settings_company_id", "app_settings", ["company_id"])


def downgrade() -> None:
    # ── app_settings ──────────────────────────────────────────────────────
    op.drop_index("ix_app_settings_company_id", table_name="app_settings")
    op.drop_constraint("uq_app_settings_company_id", "app_settings", type_="unique")
    op.drop_constraint("fk_app_settings_company_id", "app_settings", type_="foreignkey")
    op.drop_column("app_settings", "company_id")
    op.alter_column("app_settings", "user_id", existing_type=sa.Integer(), nullable=False)
    op.create_unique_constraint("app_settings_user_id_key", "app_settings", ["user_id"])

    # ── quotes ────────────────────────────────────────────────────────────
    op.drop_index("ix_quotes_company_id", table_name="quotes")
    op.drop_constraint("fk_quotes_company_id", "quotes", type_="foreignkey")
    op.drop_column("quotes", "company_id")

    # ── supplies ──────────────────────────────────────────────────────────
    op.drop_index("ix_supplies_company_id", table_name="supplies")
    op.drop_constraint("fk_supplies_company_id", "supplies", type_="foreignkey")
    op.drop_column("supplies", "company_id")

    # ── printers ──────────────────────────────────────────────────────────
    op.drop_index("ix_printers_company_id", table_name="printers")
    op.drop_constraint("fk_printers_company_id", "printers", type_="foreignkey")
    op.drop_column("printers", "company_id")

    # ── filaments ─────────────────────────────────────────────────────────
    op.drop_index("ix_filaments_company_id", table_name="filaments")
    op.drop_constraint("fk_filaments_company_id", "filaments", type_="foreignkey")
    op.drop_column("filaments", "company_id")

    # ── users ─────────────────────────────────────────────────────────────
    op.drop_index("ix_users_company_id", table_name="users")
    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_column("users", "company_id")

    # ── companies ─────────────────────────────────────────────────────────
    op.drop_table("companies")
