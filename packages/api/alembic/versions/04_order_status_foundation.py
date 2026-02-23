"""order status foundation: expires_at, new enum values, OrderStatusEvent table

Revision ID: 04_order_status_foundation
Revises: 7e65a350a3b1
Create Date: 2026-02-23 00:00:00.000000

"""
from alembic import op
from sqlalchemy import text
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '04_order_status_foundation'
down_revision = '7e65a350a3b1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Extend the PostgreSQL orderstatus enum with new values — only if the
    #    enum type exists (some DB setups use VARCHAR for orders.status instead).
    result = conn.execute(text("SELECT 1 FROM pg_type WHERE typname = 'orderstatus'"))
    if result.scalar():
        op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'created'")
        op.execute("ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS 'partially_returned'")
    # If the column is plain VARCHAR the new status strings will just be stored
    # as-is — no additional DDL needed for the enum case.

    # 2. Add expires_at column to orders table (nullable).
    op.add_column(
        'orders',
        sa.Column('expires_at', sa.DateTime(), nullable=True)
    )

    # 3. Create order_status_events table.
    op.create_table(
        'order_status_events',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('order_id', sa.String(), nullable=False),
        sa.Column('from_status', sa.String(30), nullable=True),
        sa.Column('to_status', sa.String(30), nullable=False),
        sa.Column('actor_type', sa.String(20), nullable=False),
        sa.Column('actor_id', sa.String(), nullable=True),
        sa.Column('note', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )

    # 4. Index on order_id for efficient per-order queries.
    op.create_index('ix_order_status_events_order_id', 'order_status_events', ['order_id'])


def downgrade() -> None:
    # Note: PostgreSQL does not support removing enum values.
    # 'created' and 'partially_returned' will remain in the orderstatus enum
    # (if it exists) after downgrade.

    op.drop_index('ix_order_status_events_order_id', table_name='order_status_events')
    op.drop_table('order_status_events')
    op.drop_column('orders', 'expires_at')
