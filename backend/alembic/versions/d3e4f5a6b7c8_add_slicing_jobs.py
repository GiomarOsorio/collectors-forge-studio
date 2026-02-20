"""Agregar tabla de trabajos de laminado 3D (slicing_jobs)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-02-20 23:00:00.000000

Crea la tabla slicing_jobs para registrar los trabajos de laminado
realizados por el servidor con OrcaSlicer, así como los parseos de
archivos .gcode/.3mf subidos directamente y las estimaciones obtenidas
de URLs de MakerWorld.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'slicing_jobs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('company_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('source', sa.String(length=20), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('makerworld_url', sa.String(length=500), nullable=True),
        sa.Column('makerworld_model_id', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('print_time_seconds', sa.Integer(), nullable=True),
        sa.Column('filament_weight_g', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('filament_type', sa.String(length=50), nullable=True),
        sa.Column('layer_height_mm', sa.Numeric(precision=4, scale=3), nullable=True),
        sa.Column('nozzle_temp', sa.Integer(), nullable=True),
        sa.Column('bed_temp', sa.Integer(), nullable=True),
        sa.Column('model_x_mm', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('model_y_mm', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('model_z_mm', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('printer_preset', sa.String(length=100), nullable=True),
        sa.Column('filament_preset', sa.String(length=100), nullable=True),
        sa.Column('config_preset', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_slicing_jobs_company_id'),
        'slicing_jobs',
        ['company_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_slicing_jobs_company_id'), table_name='slicing_jobs')
    op.drop_table('slicing_jobs')
