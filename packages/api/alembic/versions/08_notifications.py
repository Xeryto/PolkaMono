"""add notifications table

Revision ID: 08_notifications
Revises: 07_account_management_2fa
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = '08_notifications'
down_revision = '07_account_management_2fa'
branch_labels = None
depends_on = None


def upgrade():
    # Table may already exist if it was created outside of a migration;
    # use IF NOT EXISTS guard to make this idempotent.
    op.execute("""
        CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR NOT NULL,
            recipient_type VARCHAR(20) NOT NULL,
            recipient_id VARCHAR NOT NULL,
            type VARCHAR(50) NOT NULL,
            message VARCHAR(500) NOT NULL,
            order_id VARCHAR,
            is_read BOOLEAN NOT NULL DEFAULT false,
            expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE,
            PRIMARY KEY (id)
        )
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_notifications_recipient_id
        ON notifications (recipient_id)
    """)


def downgrade():
    op.drop_index('ix_notifications_recipient_id', table_name='notifications')
    op.drop_table('notifications')
