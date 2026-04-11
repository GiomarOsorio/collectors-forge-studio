"""Eliminar multi-tenancy: quitar company_id de todas las tablas. Agregar role en users.

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-04-11
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "h2i3j4k5l6m7"
down_revision: Union[str, None] = "g1h2i3j4k5l6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Agregar columna role en users ──────────────────────────────────
    op.add_column(
        "users",
        sa.Column("role", sa.String(20), nullable=False, server_default="operator"),
    )
    # Migrar datos: admins anteriores → role='admin'
    op.execute("UPDATE users SET role = 'admin' WHERE is_admin = TRUE")
    op.drop_column("users", "is_admin")

    # ── 2. Quitar company_id de users ─────────────────────────────────────
    op.drop_index("ix_users_company_id", table_name="users")
    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_column("users", "company_id")

    # ── 3. Quitar company_id de filaments ─────────────────────────────────
    op.drop_index("ix_filaments_company_id", table_name="filaments")
    op.drop_constraint("fk_filaments_company_id", "filaments", type_="foreignkey")
    op.drop_column("filaments", "company_id")

    # ── 4. Quitar company_id de printers ──────────────────────────────────
    op.drop_index("ix_printers_company_id", table_name="printers")
    op.drop_constraint("fk_printers_company_id", "printers", type_="foreignkey")
    op.drop_column("printers", "company_id")

    # ── 5. Quitar company_id de supplies ──────────────────────────────────
    op.drop_index("ix_supplies_company_id", table_name="supplies")
    op.drop_constraint("fk_supplies_company_id", "supplies", type_="foreignkey")
    op.drop_column("supplies", "company_id")

    # ── 6. Quitar company_id de quotes ────────────────────────────────────
    op.drop_index("ix_quotes_company_id", table_name="quotes")
    op.drop_constraint("fk_quotes_company_id", "quotes", type_="foreignkey")
    op.drop_column("quotes", "company_id")

    # ── 7. Quitar company_id de client_quotes ─────────────────────────────
    op.drop_index("ix_client_quotes_company_id", table_name="client_quotes")
    op.drop_constraint("fk_client_quotes_company_id", "client_quotes", type_="foreignkey")
    op.drop_column("client_quotes", "company_id")

    # ── 8. Quitar company_id de inventory_items ───────────────────────────
    op.drop_index("ix_inventory_items_company_id", table_name="inventory_items")
    op.drop_constraint("fk_inventory_items_company_id", "inventory_items", type_="foreignkey")
    op.drop_column("inventory_items", "company_id")

    # ── 9. Quitar company_id de inventory_categories ──────────────────────
    op.drop_constraint("uq_inventory_category_company_name", "inventory_categories", type_="unique")
    op.drop_index("ix_inventory_categories_company_id", table_name="inventory_categories")
    op.drop_constraint("inventory_categories_company_id_fkey", "inventory_categories", type_="foreignkey")
    op.drop_column("inventory_categories", "company_id")
    # Crear nueva constraint UNIQUE solo por nombre (mono-empresa)
    op.create_unique_constraint("uq_inventory_category_name", "inventory_categories", ["name"])

    # ── 10. Quitar company_id de purchase_orders ──────────────────────────
    op.drop_index("ix_purchase_orders_company_id", table_name="purchase_orders")
    op.drop_constraint("fk_purchase_orders_company_id", "purchase_orders", type_="foreignkey")
    op.drop_column("purchase_orders", "company_id")

    # ── 11. Quitar company_id de printed_items ────────────────────────────
    op.drop_index("ix_printed_items_company_id", table_name="printed_items")
    op.drop_constraint("printed_items_company_id_fkey", "printed_items", type_="foreignkey")
    op.drop_column("printed_items", "company_id")

    # ── 12. Quitar company_id de slicing_jobs ─────────────────────────────
    op.drop_index("ix_slicing_jobs_company_id", table_name="slicing_jobs")
    op.drop_constraint("slicing_jobs_company_id_fkey", "slicing_jobs", type_="foreignkey")
    op.drop_column("slicing_jobs", "company_id")

    # ── 13. Quitar company_id de print_queue ──────────────────────────────
    op.drop_index("ix_print_queue_company_id", table_name="print_queue")
    op.drop_constraint("print_queue_company_id_fkey", "print_queue", type_="foreignkey")
    op.drop_column("print_queue", "company_id")

    # ── 14. Quitar company_id de app_settings ─────────────────────────────
    op.drop_index("ix_app_settings_company_id", table_name="app_settings")
    op.drop_constraint("uq_app_settings_company_id", "app_settings", type_="unique")
    op.drop_constraint("fk_app_settings_company_id", "app_settings", type_="foreignkey")
    op.drop_column("app_settings", "company_id")

    # ── 15. Quitar company_id de maintenance_logs ─────────────────────────
    op.drop_index("ix_maintenance_logs_company_id", table_name="maintenance_logs")
    op.drop_constraint("maintenance_logs_company_id_fkey", "maintenance_logs", type_="foreignkey")
    op.drop_column("maintenance_logs", "company_id")

    # ── 16. Quitar company_id de company_templates ────────────────────────
    op.drop_index("ix_company_templates_company_id", table_name="company_templates")
    op.drop_constraint("company_templates_company_id_fkey", "company_templates", type_="foreignkey")
    op.drop_column("company_templates", "company_id")

    # ── 17. Quitar company_id de model_files ──────────────────────────────
    op.drop_index("ix_model_files_company_id", table_name="model_files")
    op.drop_constraint("model_files_company_id_fkey", "model_files", type_="foreignkey")
    op.drop_column("model_files", "company_id")


def downgrade() -> None:
    # Restaurar company_id en todas las tablas (nullable para retrocompatibilidad)
    DEFAULT_COMPANY_ID = "00000000-0000-0000-0000-000000000001"

    # ── model_files ───────────────────────────────────────────────────────
    op.add_column("model_files", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE model_files SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("model_files_company_id_fkey", "model_files", "companies", ["company_id"], ["id"])
    op.create_index("ix_model_files_company_id", "model_files", ["company_id"])

    # ── company_templates ─────────────────────────────────────────────────
    op.add_column("company_templates", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE company_templates SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("company_templates_company_id_fkey", "company_templates", "companies", ["company_id"], ["id"], ondelete="CASCADE")
    op.create_index("ix_company_templates_company_id", "company_templates", ["company_id"])

    # ── maintenance_logs ──────────────────────────────────────────────────
    op.add_column("maintenance_logs", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE maintenance_logs SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("maintenance_logs_company_id_fkey", "maintenance_logs", "companies", ["company_id"], ["id"])
    op.create_index("ix_maintenance_logs_company_id", "maintenance_logs", ["company_id"])

    # ── app_settings ──────────────────────────────────────────────────────
    op.add_column("app_settings", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE app_settings SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_app_settings_company_id", "app_settings", "companies", ["company_id"], ["id"])
    op.create_unique_constraint("uq_app_settings_company_id", "app_settings", ["company_id"])
    op.create_index("ix_app_settings_company_id", "app_settings", ["company_id"])

    # ── print_queue ───────────────────────────────────────────────────────
    op.add_column("print_queue", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE print_queue SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("print_queue_company_id_fkey", "print_queue", "companies", ["company_id"], ["id"])
    op.create_index("ix_print_queue_company_id", "print_queue", ["company_id"])

    # ── slicing_jobs ──────────────────────────────────────────────────────
    op.add_column("slicing_jobs", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE slicing_jobs SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("slicing_jobs_company_id_fkey", "slicing_jobs", "companies", ["company_id"], ["id"])
    op.create_index("ix_slicing_jobs_company_id", "slicing_jobs", ["company_id"])

    # ── printed_items ─────────────────────────────────────────────────────
    op.add_column("printed_items", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE printed_items SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("printed_items_company_id_fkey", "printed_items", "companies", ["company_id"], ["id"])
    op.create_index("ix_printed_items_company_id", "printed_items", ["company_id"])

    # ── purchase_orders ───────────────────────────────────────────────────
    op.add_column("purchase_orders", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE purchase_orders SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_purchase_orders_company_id", "purchase_orders", "companies", ["company_id"], ["id"])
    op.create_index("ix_purchase_orders_company_id", "purchase_orders", ["company_id"])

    # ── inventory_categories ──────────────────────────────────────────────
    op.drop_constraint("uq_inventory_category_name", "inventory_categories", type_="unique")
    op.add_column("inventory_categories", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE inventory_categories SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("inventory_categories_company_id_fkey", "inventory_categories", "companies", ["company_id"], ["id"])
    op.create_index("ix_inventory_categories_company_id", "inventory_categories", ["company_id"])
    op.create_unique_constraint("uq_inventory_category_company_name", "inventory_categories", ["company_id", "name"])

    # ── inventory_items ───────────────────────────────────────────────────
    op.add_column("inventory_items", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE inventory_items SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_inventory_items_company_id", "inventory_items", "companies", ["company_id"], ["id"])
    op.create_index("ix_inventory_items_company_id", "inventory_items", ["company_id"])

    # ── client_quotes ─────────────────────────────────────────────────────
    op.add_column("client_quotes", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE client_quotes SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_client_quotes_company_id", "client_quotes", "companies", ["company_id"], ["id"])
    op.create_index("ix_client_quotes_company_id", "client_quotes", ["company_id"])

    # ── quotes ────────────────────────────────────────────────────────────
    op.add_column("quotes", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE quotes SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_quotes_company_id", "quotes", "companies", ["company_id"], ["id"])
    op.create_index("ix_quotes_company_id", "quotes", ["company_id"])

    # ── supplies ──────────────────────────────────────────────────────────
    op.add_column("supplies", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE supplies SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_supplies_company_id", "supplies", "companies", ["company_id"], ["id"])
    op.create_index("ix_supplies_company_id", "supplies", ["company_id"])

    # ── printers ──────────────────────────────────────────────────────────
    op.add_column("printers", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE printers SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_printers_company_id", "printers", "companies", ["company_id"], ["id"])
    op.create_index("ix_printers_company_id", "printers", ["company_id"])

    # ── filaments ─────────────────────────────────────────────────────────
    op.add_column("filaments", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE filaments SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_filaments_company_id", "filaments", "companies", ["company_id"], ["id"])
    op.create_index("ix_filaments_company_id", "filaments", ["company_id"])

    # ── users ─────────────────────────────────────────────────────────────
    op.add_column("users", sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(f"UPDATE users SET company_id = '{DEFAULT_COMPANY_ID}'")
    op.create_foreign_key("fk_users_company_id", "users", "companies", ["company_id"], ["id"])
    op.create_index("ix_users_company_id", "users", ["company_id"])

    # ── Restaurar is_admin desde role ─────────────────────────────────────
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"))
    op.execute("UPDATE users SET is_admin = TRUE WHERE role = 'admin'")
    op.drop_column("users", "role")
