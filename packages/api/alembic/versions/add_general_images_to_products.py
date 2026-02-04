"""Add general_images to products

Revision ID: add_general_images
Revises: product_color_variants
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'add_general_images'
down_revision = 'product_color_variants'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'products',
        sa.Column('general_images', postgresql.ARRAY(sa.String()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('products', 'general_images')
