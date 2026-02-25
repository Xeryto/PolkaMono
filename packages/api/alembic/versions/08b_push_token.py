"""add expo_push_token to users

Revision ID: 08b_push_token
Revises: 08_notifications
Create Date: 2026-02-24

"""
from alembic import op
import sqlalchemy as sa

revision = '08b_push_token'
down_revision = '08_notifications'
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    cols = [c['name'] for c in inspector.get_columns('users')]
    if 'expo_push_token' not in cols:
        op.add_column('users', sa.Column('expo_push_token', sa.String(200), nullable=True))


def downgrade():
    op.drop_column('users', 'expo_push_token')
