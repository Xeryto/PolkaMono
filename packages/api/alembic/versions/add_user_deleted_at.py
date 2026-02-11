"""Add deleted_at to users for account deletion (soft delete + anonymization)

Revision ID: add_user_deleted_at
Revises: add_general_images
Create Date: 2026-02-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'add_user_deleted_at'
down_revision = 'add_general_images'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # On an empty DB, init_db() creates tables from current models, so users
    # may already have deleted_at. Only add if missing.
    conn = op.get_bind()
    inspector = inspect(conn)
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    if 'deleted_at' not in users_columns:
        op.add_column(
            'users',
            sa.Column('deleted_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    if 'deleted_at' in users_columns:
        op.drop_column('users', 'deleted_at')
