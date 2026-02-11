"""Add general_images to products

Revision ID: add_general_images
Revises: product_color_variants
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import inspect

revision = 'add_general_images'
down_revision = 'product_color_variants'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # On an empty DB, init_db() in the initial migration creates tables from
    # current models, so products already has general_images. Only add if missing.
    conn = op.get_bind()
    inspector = inspect(conn)
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    if 'general_images' not in products_columns:
        op.add_column(
            'products',
            sa.Column('general_images', postgresql.ARRAY(sa.String()), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    if 'general_images' in products_columns:
        op.drop_column('products', 'general_images')
