"""Add avatar_url_full and avatar_crop to user_profiles

Revision ID: avatar_full_crop
Revises: auth_accounts_shared
Create Date: 2026-02-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'avatar_full_crop'
down_revision = 'auth_accounts_shared'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('user_profiles')]
    if 'avatar_url_full' not in cols:
        op.add_column(
            'user_profiles',
            sa.Column('avatar_url_full', sa.String(500), nullable=True),
        )
    if 'avatar_crop' not in cols:
        op.add_column(
            'user_profiles',
            sa.Column('avatar_crop', sa.String(1000), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('user_profiles')]
    if 'avatar_crop' in cols:
        op.drop_column('user_profiles', 'avatar_crop')
    if 'avatar_url_full' in cols:
        op.drop_column('user_profiles', 'avatar_url_full')
