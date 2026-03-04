"""Normalize orderstatus values to lowercase in orders table

Revision ID: normalize_orderstatus_enum
Revises: add_friendship_indexes
"""
from alembic import op

revision = 'normalize_orderstatus_enum'
down_revision = 'add_friendship_indexes'
branch_labels = None
depends_on = None


def upgrade():
    # Status column is String(20) via TypeDecorator, not a native PG enum.
    # Update existing uppercase values to lowercase.
    op.execute("UPDATE orders SET status = 'pending' WHERE status = 'PENDING'")
    op.execute("UPDATE orders SET status = 'paid' WHERE status = 'PAID'")
    op.execute("UPDATE orders SET status = 'canceled' WHERE status = 'CANCELED'")


def downgrade():
    op.execute("UPDATE orders SET status = 'PENDING' WHERE status = 'pending'")
    op.execute("UPDATE orders SET status = 'PAID' WHERE status = 'paid'")
    op.execute("UPDATE orders SET status = 'CANCELED' WHERE status = 'canceled'")
