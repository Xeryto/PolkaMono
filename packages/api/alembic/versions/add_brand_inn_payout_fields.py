"""add INN, registration_address, payout_account, payout_account_locked to brands

Revision ID: add_brand_inn_payout
Revises: auth_accounts_shared
Create Date: 2026-02-16

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_brand_inn_payout'
down_revision = 'auth_accounts_shared'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('brands')]
    if 'inn' not in cols:
        op.add_column('brands', sa.Column('inn', sa.String(20), nullable=True))
    if 'registration_address' not in cols:
        op.add_column('brands', sa.Column('registration_address', sa.Text(), nullable=True))
    if 'payout_account' not in cols:
        op.add_column('brands', sa.Column('payout_account', sa.String(100), nullable=True))
    if 'payout_account_locked' not in cols:
        op.add_column('brands', sa.Column('payout_account_locked', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    cols = [c['name'] for c in inspector.get_columns('brands')]
    if 'payout_account_locked' in cols:
        op.drop_column('brands', 'payout_account_locked')
    if 'payout_account' in cols:
        op.drop_column('brands', 'payout_account')
    if 'registration_address' in cols:
        op.drop_column('brands', 'registration_address')
    if 'inn' in cols:
        op.drop_column('brands', 'inn')
