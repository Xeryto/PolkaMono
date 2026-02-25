"""Migrate brands.id from Integer to UUID string (destructive, dev only)

Revision ID: 09b_brand_uuid
Revises: 09_admin_account
Create Date: 2026-02-25

Destructive: existing brand rows get new UUID PKs. All FK child rows
(products, orders, user_brands) that referenced old integer IDs are dropped
and recreated as VARCHAR. Acceptable for dev environment.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '09b_brand_uuid'
down_revision = '09_admin_account'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # 1. Drop FK constraints on child tables
    conn.execute(text("ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_id_fkey"))
    conn.execute(text("ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_brand_id_fkey"))
    conn.execute(text("ALTER TABLE user_brands DROP CONSTRAINT IF EXISTS user_brands_brand_id_fkey"))

    # 2. Drop child brand_id columns (they hold integer values, incompatible with new UUID PK)
    conn.execute(text("ALTER TABLE products DROP COLUMN IF EXISTS brand_id"))
    conn.execute(text("ALTER TABLE orders DROP COLUMN IF EXISTS brand_id"))
    conn.execute(text("ALTER TABLE user_brands DROP COLUMN IF EXISTS brand_id"))

    # 3. Drop old brands PK and recreate as UUID VARCHAR
    #    We keep all other brand columns intact; only the PK type changes.
    conn.execute(text("ALTER TABLE brands DROP CONSTRAINT IF EXISTS brands_pkey"))
    conn.execute(text("ALTER TABLE brands DROP COLUMN IF EXISTS id"))
    conn.execute(text(
        "ALTER TABLE brands ADD COLUMN id VARCHAR NOT NULL DEFAULT gen_random_uuid()"
    ))
    conn.execute(text("ALTER TABLE brands ADD PRIMARY KEY (id)"))

    # 4. Truncate user_brands (orphaned rows after brand_id column drop; dev only)
    conn.execute(text("TRUNCATE TABLE user_brands"))

    # 5. Re-add brand_id columns as VARCHAR (nullable, then constrained)
    conn.execute(text("ALTER TABLE products ADD COLUMN brand_id VARCHAR REFERENCES brands(id) ON DELETE RESTRICT"))
    conn.execute(text("ALTER TABLE orders ADD COLUMN brand_id VARCHAR REFERENCES brands(id) ON DELETE RESTRICT"))
    conn.execute(text("ALTER TABLE user_brands ADD COLUMN brand_id VARCHAR NOT NULL REFERENCES brands(id) ON DELETE CASCADE"))

    # 6. Re-add unique constraint on user_brands (user_id, brand_id)
    conn.execute(text(
        "ALTER TABLE user_brands DROP CONSTRAINT IF EXISTS uq_user_brand"
    ))
    conn.execute(text(
        "ALTER TABLE user_brands ADD CONSTRAINT uq_user_brand UNIQUE (user_id, brand_id)"
    ))


def downgrade():
    # Downgrade not supported — this is a destructive dev migration
    raise NotImplementedError("Downgrade not supported for brand UUID migration")
