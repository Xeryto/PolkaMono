"""add shipped and returned to orderstatus enum

Revision ID: add_order_shipped_returned
Revises: add_brand_inn_payout
Create Date: 2026-02-18

"""
from alembic import op
from sqlalchemy import text


revision = "add_order_shipped_returned"
down_revision = "add_brand_inn_payout"
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    # When init_db() creates schema, orders.status is VARCHAR(20), not a PG enum.
    # Only alter if orderstatus enum exists (legacy migration path).
    result = conn.execute(text(
        "SELECT 1 FROM pg_type WHERE typname = 'orderstatus'"
    ))
    if result.scalar():
        op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'shipped'")
        op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'returned'")


def downgrade():
    # PostgreSQL does not support removing enum values easily.
    # New values remain; downgrade is a no-op.
    pass
