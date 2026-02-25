"""account management and 2fa columns

Revision ID: 07_account_management_2fa
Revises: 7895696e1a95
Create Date: 2026-02-24
"""
from alembic import op
import sqlalchemy as sa

revision = '07_account_management_2fa'
down_revision = '7895696e1a95'
branch_labels = None
depends_on = None

def upgrade():
    inspector = sa.inspect(op.get_bind())
    brand_cols = [c['name'] for c in inspector.get_columns('brands')]
    auth_cols = [c['name'] for c in inspector.get_columns('auth_accounts')]
    if 'is_inactive' not in brand_cols:
        op.add_column('brands', sa.Column('is_inactive', sa.Boolean(), nullable=False, server_default='false'))
    if 'scheduled_deletion_at' not in brand_cols:
        op.add_column('brands', sa.Column('scheduled_deletion_at', sa.DateTime(), nullable=True))
    if 'two_factor_enabled' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false'))
    if 'otp_code' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('otp_code', sa.String(6), nullable=True))
    if 'otp_code_expires_at' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('otp_code_expires_at', sa.DateTime(), nullable=True))
    if 'otp_session_token' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('otp_session_token', sa.String(64), nullable=True))
    if 'failed_otp_attempts' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('failed_otp_attempts', sa.Integer(), nullable=False, server_default='0'))
    if 'otp_locked_until' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('otp_locked_until', sa.DateTime(), nullable=True))
    if 'otp_resend_count' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('otp_resend_count', sa.Integer(), nullable=False, server_default='0'))
    if 'otp_resend_window_start' not in auth_cols:
        op.add_column('auth_accounts', sa.Column('otp_resend_window_start', sa.DateTime(), nullable=True))

def downgrade():
    op.drop_column('brands', 'is_inactive')
    op.drop_column('brands', 'scheduled_deletion_at')
    op.drop_column('auth_accounts', 'two_factor_enabled')
    op.drop_column('auth_accounts', 'otp_code')
    op.drop_column('auth_accounts', 'otp_code_expires_at')
    op.drop_column('auth_accounts', 'otp_session_token')
    op.drop_column('auth_accounts', 'failed_otp_attempts')
    op.drop_column('auth_accounts', 'otp_locked_until')
    op.drop_column('auth_accounts', 'otp_resend_count')
    op.drop_column('auth_accounts', 'otp_resend_window_start')
