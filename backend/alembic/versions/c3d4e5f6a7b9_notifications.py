"""Sistema de notificaciones multi-canal (issue #137).

Revision ID: c3d4e5f6a7b9
Revises: b2c3d4e5f6a8
Create Date: 2026-07-14

Agrega:
- notification_channels, notification_templates, notification_digest_queue.
- Columnas SMTP + quiet hours + digest en app_settings.
- Columna spool_low_stock_threshold_g faltante en app_settings ORM ya
  existía en BD (migración 8422a0c213e9), este migration NO la vuelve a
  crear — el fix fue solo en el modelo Python (nunca estuvo mapeada).
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a7b9"
down_revision: Union[str, None] = "b2c3d4e5f6a8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notification_channels",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("type", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("config", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("events", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("defer_to_digest", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "type IN ('telegram', 'discord', 'ntfy', 'email', 'webhook')",
            name="ck_notification_channels_type",
        ),
    )

    op.create_table(
        "notification_templates",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event", sa.String(length=50), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("event", name="uq_notification_templates_event"),
    )

    op.create_table(
        "notification_digest_queue",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("channel_id", sa.Integer(), nullable=False),
        sa.Column("event", sa.String(length=50), nullable=False),
        sa.Column("rendered_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["channel_id"], ["notification_channels.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_notification_digest_queue_channel_id",
        "notification_digest_queue", ["channel_id"],
    )

    op.add_column("app_settings", sa.Column("smtp_host", sa.String(length=255), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_port", sa.Integer(), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_user", sa.String(length=255), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_password", sa.String(length=255), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_from", sa.String(length=255), nullable=True))
    op.add_column("app_settings", sa.Column("smtp_tls", sa.Boolean(), nullable=False, server_default=sa.text("true")))
    op.add_column("app_settings", sa.Column("quiet_hours_start", sa.String(length=5), nullable=True))
    op.add_column("app_settings", sa.Column("quiet_hours_end", sa.String(length=5), nullable=True))
    op.add_column("app_settings", sa.Column("digest_hour", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_settings_digest_hour_range",
        "app_settings",
        "digest_hour IS NULL OR (digest_hour >= 0 AND digest_hour <= 23)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_settings_digest_hour_range", "app_settings", type_="check")
    op.drop_column("app_settings", "digest_hour")
    op.drop_column("app_settings", "quiet_hours_end")
    op.drop_column("app_settings", "quiet_hours_start")
    op.drop_column("app_settings", "smtp_tls")
    op.drop_column("app_settings", "smtp_from")
    op.drop_column("app_settings", "smtp_password")
    op.drop_column("app_settings", "smtp_user")
    op.drop_column("app_settings", "smtp_port")
    op.drop_column("app_settings", "smtp_host")

    op.drop_index("ix_notification_digest_queue_channel_id", table_name="notification_digest_queue")
    op.drop_table("notification_digest_queue")
    op.drop_table("notification_templates")
    op.drop_table("notification_channels")
