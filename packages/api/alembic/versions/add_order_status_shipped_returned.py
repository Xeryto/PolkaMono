"""add shipped and returned to orderstatus enum

Revision ID: add_order_shipped_returned
Revises: add_brand_inn_payout
Create Date: 2026-02-18

"""
from alembic import op


revision = "add_order_shipped_returned"
down_revision = "add_brand_inn_payout"
branch_labels = None
depends_on = None


def upgrade():
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'shipped'")
    op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'returned'")


def downgrade():
    # PostgreSQL does not support removing enum values easily.
    # New values remain; downgrade is a no-op.
    pass
