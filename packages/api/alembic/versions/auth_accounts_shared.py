"""Shared auth_accounts table; users and brands reference it

Revision ID: auth_accounts_shared
Revises: option2_swipe_grounds
Create Date: 2026-02-16

Works from current DB (backfill from users/brands) and from empty DB (no rows to backfill).
"""
from alembic import op
import uuid
import sqlalchemy as sa
from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import ARRAY

revision = 'auth_accounts_shared'
down_revision = 'option2_swipe_grounds'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()

    # 1. Create auth_accounts if not present
    if 'auth_accounts' not in tables:
        op.create_table(
            'auth_accounts',
            sa.Column('id', sa.String(), nullable=False),
            sa.Column('email', sa.String(255), nullable=False),
            sa.Column('password_hash', sa.String(255), nullable=True),
            sa.Column('is_email_verified', sa.Boolean(), nullable=True, server_default='false'),
            sa.Column('email_verification_code', sa.String(6), nullable=True),
            sa.Column('email_verification_code_expires_at', sa.DateTime(), nullable=True),
            sa.Column('password_reset_token', sa.String(), nullable=True),
            sa.Column('password_reset_expires', sa.DateTime(), nullable=True),
            sa.Column('password_history', ARRAY(sa.String()), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.Column('updated_at', sa.DateTime(), nullable=True),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_auth_accounts_email', 'auth_accounts', ['email'], unique=True)

    users_cols = [c['name'] for c in inspector.get_columns('users')] if 'users' in tables else []
    brands_cols = [c['name'] for c in inspector.get_columns('brands')] if 'brands' in tables else []

    # 2. Migrate users: add auth_account_id, backfill, drop old auth columns
    if 'users' in tables and 'email' in users_cols:
        if 'auth_account_id' not in users_cols:
            op.add_column(
                'users',
                sa.Column('auth_account_id', sa.String(), nullable=True),
            )
            op.create_foreign_key(
                'fk_users_auth_account_id', 'users', 'auth_accounts',
                ['auth_account_id'], ['id'], ondelete='CASCADE',
            )
        # Backfill: one auth_account per user
        rows = conn.execute(text(
            'SELECT id, email, password_hash, is_email_verified, email_verification_code, '
            'email_verification_code_expires_at, password_reset_token, password_reset_expires, password_history, created_at, updated_at '
            'FROM users'
        )).fetchall()
        for row in rows:
            (user_id, email, password_hash, is_email_verified, email_verification_code,
             email_verification_code_expires_at, password_reset_token, password_reset_expires,
             password_history, created_at, updated_at) = row
            acc_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO auth_accounts (id, email, password_hash, is_email_verified,
                    email_verification_code, email_verification_code_expires_at,
                    password_reset_token, password_reset_expires, password_history, created_at, updated_at)
                VALUES (:id, :email, :password_hash, :is_email_verified,
                    :email_verification_code, :email_verification_code_expires_at,
                    :password_reset_token, :password_reset_expires, :password_history, :created_at, :updated_at)
            """), {
                'id': acc_id, 'email': email or '', 'password_hash': password_hash,
                'is_email_verified': is_email_verified or False,
                'email_verification_code': email_verification_code,
                'email_verification_code_expires_at': email_verification_code_expires_at,
                'password_reset_token': password_reset_token,
                'password_reset_expires': password_reset_expires,
                'password_history': password_history or [],
                'created_at': created_at,
                'updated_at': updated_at,
            }
            )
            conn.execute(text('UPDATE users SET auth_account_id = :aid WHERE id = :uid'), {'aid': acc_id, 'uid': user_id})
        op.alter_column(
            'users', 'auth_account_id',
            existing_type=sa.String(),
            nullable=False,
        )
        op.create_unique_constraint('uq_users_auth_account_id', 'users', ['auth_account_id'])
        # Drop old auth columns
        for col in ('password_history', 'password_reset_expires', 'password_reset_token',
                    'email_verification_code_expires_at', 'email_verification_code', 'is_email_verified',
                    'password_hash', 'email'):
            if col in users_cols:
                op.drop_column('users', col)

    # 3. Migrate brands: add auth_account_id, backfill, drop old auth columns
    if 'brands' in tables and 'email' in brands_cols:
        if 'auth_account_id' not in brands_cols:
            op.add_column(
                'brands',
                sa.Column('auth_account_id', sa.String(), nullable=True),
            )
            op.create_foreign_key(
                'fk_brands_auth_account_id', 'brands', 'auth_accounts',
                ['auth_account_id'], ['id'], ondelete='CASCADE',
            )
        rows = conn.execute(text(
            'SELECT id, email, password_hash, email_verification_code, '
            'email_verification_code_expires_at, password_reset_token, password_reset_expires, password_history, created_at, updated_at '
            'FROM brands'
        )).fetchall()
        for row in rows:
            (brand_id, email, password_hash, email_verification_code,
             email_verification_code_expires_at, password_reset_token, password_reset_expires,
             password_history, created_at, updated_at) = row
            acc_id = str(uuid.uuid4())
            conn.execute(text("""
                INSERT INTO auth_accounts (id, email, password_hash, is_email_verified,
                    email_verification_code, email_verification_code_expires_at,
                    password_reset_token, password_reset_expires, password_history, created_at, updated_at)
                VALUES (:id, :email, :password_hash, true,
                    :email_verification_code, :email_verification_code_expires_at,
                    :password_reset_token, :password_reset_expires, :password_history, :created_at, :updated_at)
            """), {
                'id': acc_id, 'email': email or '', 'password_hash': password_hash or '',
                'email_verification_code': email_verification_code,
                'email_verification_code_expires_at': email_verification_code_expires_at,
                'password_reset_token': password_reset_token,
                'password_reset_expires': password_reset_expires,
                'password_history': password_history or [],
                'created_at': created_at,
                'updated_at': updated_at,
            }
            )
            conn.execute(text('UPDATE brands SET auth_account_id = :aid WHERE id = :bid'), {'aid': acc_id, 'bid': brand_id})
        op.alter_column(
            'brands', 'auth_account_id',
            existing_type=sa.String(),
            nullable=False,
        )
        op.create_unique_constraint('uq_brands_auth_account_id', 'brands', ['auth_account_id'])
        for col in ('password_history', 'password_reset_expires', 'password_reset_token',
                    'email_verification_code_expires_at', 'email_verification_code',
                    'password_hash', 'email'):
            if col in brands_cols:
                op.drop_column('brands', col)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    tables = inspector.get_table_names()
    users_cols = [c['name'] for c in inspector.get_columns('users')] if 'users' in tables else []
    brands_cols = [c['name'] for c in inspector.get_columns('brands')] if 'brands' in tables else []

    # Restore users auth columns and repopulate from auth_accounts, then drop auth_account_id
    if 'users' in tables and 'auth_account_id' in users_cols:
        op.add_column('users', sa.Column('email', sa.String(255), nullable=True))
        op.add_column('users', sa.Column('password_hash', sa.String(255), nullable=True))
        op.add_column('users', sa.Column('is_email_verified', sa.Boolean(), nullable=True, server_default='false'))
        op.add_column('users', sa.Column('email_verification_code', sa.String(6), nullable=True))
        op.add_column('users', sa.Column('email_verification_code_expires_at', sa.DateTime(), nullable=True))
        op.add_column('users', sa.Column('password_reset_token', sa.String(), nullable=True))
        op.add_column('users', sa.Column('password_reset_expires', sa.DateTime(), nullable=True))
        op.add_column('users', sa.Column('password_history', ARRAY(sa.String()), nullable=True))
        conn.execute(text("""
            UPDATE users u SET
                email = a.email,
                password_hash = a.password_hash,
                is_email_verified = a.is_email_verified,
                email_verification_code = a.email_verification_code,
                email_verification_code_expires_at = a.email_verification_code_expires_at,
                password_reset_token = a.password_reset_token,
                password_reset_expires = a.password_reset_expires,
                password_history = a.password_history
            FROM auth_accounts a
            WHERE u.auth_account_id = a.id
        """))
        op.drop_constraint('uq_users_auth_account_id', 'users', type_='unique')
        op.drop_constraint('fk_users_auth_account_id', 'users', type_='foreignkey')
        op.drop_column('users', 'auth_account_id')

    # Restore brands auth columns
    if 'brands' in tables and 'auth_account_id' in brands_cols:
        op.add_column('brands', sa.Column('email', sa.String(255), nullable=True))
        op.add_column('brands', sa.Column('password_hash', sa.String(255), nullable=True))
        op.add_column('brands', sa.Column('email_verification_code', sa.String(6), nullable=True))
        op.add_column('brands', sa.Column('email_verification_code_expires_at', sa.DateTime(), nullable=True))
        op.add_column('brands', sa.Column('password_reset_token', sa.String(), nullable=True))
        op.add_column('brands', sa.Column('password_reset_expires', sa.DateTime(), nullable=True))
        op.add_column('brands', sa.Column('password_history', ARRAY(sa.String()), nullable=True))
        conn.execute(text("""
            UPDATE brands b SET
                email = a.email,
                password_hash = a.password_hash,
                email_verification_code = a.email_verification_code,
                email_verification_code_expires_at = a.email_verification_code_expires_at,
                password_reset_token = a.password_reset_token,
                password_reset_expires = a.password_reset_expires,
                password_history = a.password_history
            FROM auth_accounts a
            WHERE b.auth_account_id = a.id
        """))
        op.drop_constraint('uq_brands_auth_account_id', 'brands', type_='unique')
        op.drop_constraint('fk_brands_auth_account_id', 'brands', type_='foreignkey')
        op.drop_column('brands', 'auth_account_id')

    if 'auth_accounts' in tables:
        op.drop_index('ix_auth_accounts_email', table_name='auth_accounts')
        op.drop_table('auth_accounts')
