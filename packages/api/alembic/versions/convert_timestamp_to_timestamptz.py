"""convert all timestamp columns to timestamptz

Revision ID: convert_to_timestamptz
Revises: rename_fulfilled_shipped
Create Date: 2026-03-01

"""
from alembic import op

revision = 'convert_to_timestamptz'
down_revision = 'rename_fulfilled_shipped'
branch_labels = None
depends_on = None

# (table, column) for every DateTime column in models.py
COLUMNS = [
    ("auth_accounts", "email_verification_code_expires_at"),
    ("auth_accounts", "password_reset_expires"),
    ("auth_accounts", "otp_code_expires_at"),
    ("auth_accounts", "otp_locked_until"),
    ("auth_accounts", "otp_resend_window_start"),
    ("auth_accounts", "login_locked_until"),
    ("auth_accounts", "refresh_token_expires_at"),
    ("auth_accounts", "created_at"),
    ("auth_accounts", "updated_at"),
    ("users", "deleted_at"),
    ("users", "created_at"),
    ("users", "updated_at"),
    ("user_profiles", "created_at"),
    ("user_profiles", "updated_at"),
    ("user_shipping_info", "created_at"),
    ("user_shipping_info", "updated_at"),
    ("user_preferences", "created_at"),
    ("user_preferences", "updated_at"),
    ("oauth_accounts", "expires_at"),
    ("oauth_accounts", "created_at"),
    ("oauth_accounts", "updated_at"),
    ("brands", "scheduled_deletion_at"),
    ("brands", "created_at"),
    ("brands", "updated_at"),
    ("styles", "created_at"),
    ("styles", "updated_at"),
    ("categories", "created_at"),
    ("categories", "updated_at"),
    ("user_brands", "created_at"),
    ("user_styles", "created_at"),
    ("product_styles", "created_at"),
    ("products", "created_at"),
    ("products", "updated_at"),
    ("product_color_variants", "created_at"),
    ("product_color_variants", "updated_at"),
    ("product_variants", "created_at"),
    ("product_variants", "updated_at"),
    ("user_liked_products", "created_at"),
    ("user_swipes", "created_at"),
    ("friend_requests", "created_at"),
    ("friend_requests", "updated_at"),
    ("friendships", "created_at"),
    ("checkouts", "created_at"),
    ("checkouts", "updated_at"),
    ("orders", "created_at"),
    ("orders", "updated_at"),
    ("orders", "expires_at"),
    ("payments", "created_at"),
    ("payments", "updated_at"),
    ("exclusive_access_emails", "created_at"),
    ("order_status_events", "created_at"),
    ("brand_withdrawals", "created_at"),
    ("notifications", "expires_at"),
    ("notifications", "created_at"),
]


def upgrade():
    for table, col in COLUMNS:
        op.execute(
            f'ALTER TABLE {table} ALTER COLUMN {col} '
            f"TYPE TIMESTAMPTZ USING {col} AT TIME ZONE 'UTC'"
        )


def downgrade():
    for table, col in COLUMNS:
        op.execute(
            f'ALTER TABLE {table} ALTER COLUMN {col} '
            f"TYPE TIMESTAMP USING {col} AT TIME ZONE 'UTC'"
        )
