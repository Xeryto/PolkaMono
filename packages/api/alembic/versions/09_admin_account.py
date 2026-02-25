"""Add is_admin to auth_accounts

Revision ID: 09_admin_account
Revises: 08b_push_token
Create Date: 2026-02-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '09_admin_account'
down_revision = '08b_push_token'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c['name'] for c in inspector.get_columns('auth_accounts')]

    if 'is_admin' not in columns:
        op.add_column('auth_accounts', sa.Column('is_admin', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('auth_accounts', 'is_admin')
