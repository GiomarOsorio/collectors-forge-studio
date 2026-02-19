"""Esquema inicial de TurtleForge Cost

Revision ID: a3f8d2c19b47
Revises:
Create Date: 2026-02-19 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f8d2c19b47'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── users ──────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)

    # ── filaments ──────────────────────────────────────────────────────────
    op.create_table(
        'filaments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('brand', sa.String(length=100), nullable=False),
        sa.Column('type', sa.String(length=50), nullable=False),
        sa.Column('color', sa.String(length=50), nullable=False),
        sa.Column('price_per_kg', sa.Float(), nullable=False),
        sa.Column('weight_per_roll', sa.Float(), nullable=False),
        sa.Column('diameter', sa.Float(), nullable=False),
        sa.Column('density', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── printers ───────────────────────────────────────────────────────────
    op.create_table(
        'printers',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=False),
        sa.Column('purchase_price', sa.Float(), nullable=False),
        sa.Column('power_consumption_watts', sa.Float(), nullable=False),
        sa.Column('estimated_lifespan_hours', sa.Float(), nullable=False),
        sa.Column('current_hours', sa.Float(), nullable=False),
        sa.Column('nozzle_price', sa.Float(), nullable=False),
        sa.Column('nozzle_lifespan_hours', sa.Float(), nullable=False),
        sa.Column('buildplate_price', sa.Float(), nullable=False),
        sa.Column('buildplate_lifespan_hours', sa.Float(), nullable=False),
        sa.Column('other_maintenance_per_hour', sa.Float(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )

    # ── supplies ───────────────────────────────────────────────────────────
    op.create_table(
        'supplies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('price_per_unit', sa.Float(), nullable=False),
        sa.Column('pack_qty', sa.Integer(), nullable=True),
        sa.Column('pack_price', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_supplies_id'), 'supplies', ['id'], unique=False)
    op.create_index(op.f('ix_supplies_name'), 'supplies', ['name'], unique=False)

    # ── electricity_tariffs ────────────────────────────────────────────────
    op.create_table(
        'electricity_tariffs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('month_label', sa.String(), nullable=False),
        sa.Column('estrato', sa.Integer(), nullable=False),
        sa.Column('cop_market_rate', sa.Float(), nullable=False),
        sa.Column('cop_rate_used', sa.Float(), nullable=False),
        sa.Column('usd_rate', sa.Float(), nullable=False),
        sa.Column('usd_to_cop', sa.Float(), nullable=False),
        sa.Column('multiplier', sa.Float(), nullable=False),
        sa.Column('pdf_url', sa.String(), nullable=True),
        sa.Column('scraped_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('year', 'month', 'estrato', name='uq_tariff_month_estrato'),
    )
    op.create_index(op.f('ix_electricity_tariffs_id'), 'electricity_tariffs', ['id'], unique=False)
    op.create_index(op.f('ix_electricity_tariffs_year'), 'electricity_tariffs', ['year'], unique=False)

    # ── app_settings ───────────────────────────────────────────────────────
    op.create_table(
        'app_settings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('electricity_rate', sa.Float(), nullable=False),
        sa.Column('failure_rate_percent', sa.Float(), nullable=False),
        sa.Column('labor_cost_per_hour', sa.Float(), nullable=False),
        sa.Column('default_margin_percent', sa.Float(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
    )

    # ── quotes ─────────────────────────────────────────────────────────────
    op.create_table(
        'quotes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('piece_name', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('client_name', sa.String(length=200), nullable=True),
        sa.Column('filament_id', sa.Integer(), nullable=False),
        sa.Column('printer_id', sa.Integer(), nullable=False),
        sa.Column('weight_grams', sa.Float(), nullable=False),
        sa.Column('print_time_hours', sa.Float(), nullable=False),
        sa.Column('preparation_time_hours', sa.Float(), nullable=False),
        sa.Column('post_processing_time_hours', sa.Float(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('material_cost', sa.Float(), nullable=False),
        sa.Column('electricity_cost', sa.Float(), nullable=False),
        sa.Column('depreciation_cost', sa.Float(), nullable=False),
        sa.Column('maintenance_cost', sa.Float(), nullable=False),
        sa.Column('labor_cost', sa.Float(), nullable=False),
        sa.Column('failure_cost', sa.Float(), nullable=False),
        sa.Column('subtotal', sa.Float(), nullable=False),
        sa.Column('margin_percent', sa.Float(), nullable=False),
        sa.Column('margin_amount', sa.Float(), nullable=False),
        sa.Column('total_per_unit', sa.Float(), nullable=False),
        sa.Column('total_price', sa.Float(), nullable=False),
        sa.Column('supplies_cost', sa.Float(), nullable=False),
        sa.Column('supplies_detail', sa.Text(), nullable=True),
        sa.Column('additional_filaments_detail', sa.Text(), nullable=True),
        sa.Column('usd_to_cop_rate', sa.Float(), nullable=True),
        sa.Column('total_per_unit_cop', sa.Float(), nullable=True),
        sa.Column('total_price_cop', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['filament_id'], ['filaments.id']),
        sa.ForeignKeyConstraint(['printer_id'], ['printers.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('quotes')
    op.drop_table('app_settings')
    op.drop_index(op.f('ix_electricity_tariffs_year'), table_name='electricity_tariffs')
    op.drop_index(op.f('ix_electricity_tariffs_id'), table_name='electricity_tariffs')
    op.drop_table('electricity_tariffs')
    op.drop_index(op.f('ix_supplies_name'), table_name='supplies')
    op.drop_index(op.f('ix_supplies_id'), table_name='supplies')
    op.drop_table('supplies')
    op.drop_table('printers')
    op.drop_table('filaments')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
