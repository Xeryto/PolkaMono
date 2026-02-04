"""Product color variants: separate images and size/stock per color

Revision ID: product_color_variants
Revises: split_user_domains
Create Date: 2026-02-03

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'product_color_variants'
down_revision = 'split_user_domains'
branch_labels = None
depends_on = None


def _product_color_variants_table_exists(conn) -> bool:
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = 'product_color_variants'"
    ))
    return result.scalar() is not None


def upgrade() -> None:
    conn = op.get_bind()

    # When running on an empty DB, the initial migration uses init_db() which
    # creates all tables from current models (including product_color_variants).
    # Skip this migration's steps when the table already exists.
    if _product_color_variants_table_exists(conn):
        return

    # 1) Create product_color_variants table
    op.create_table(
        'product_color_variants',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('product_id', sa.String(), nullable=False),
        sa.Column('color_name', sa.String(50), nullable=False),
        sa.Column('color_hex', sa.String(50), nullable=False),
        sa.Column('images', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'color_name', name='uq_product_color'),
    )

    # 2) Backfill: one color variant per product from existing color/images
    conn.execute(sa.text("""
        INSERT INTO product_color_variants (id, product_id, color_name, color_hex, images, display_order, created_at, updated_at)
        SELECT
            gen_random_uuid()::text,
            p.id,
            COALESCE(NULLIF(TRIM(p.color), ''), 'Unknown'),
            CASE COALESCE(NULLIF(TRIM(p.color), ''), 'Unknown')
                WHEN 'Black' THEN '#000000'
                WHEN 'Blue' THEN '#0000FF'
                WHEN 'Brown' THEN '#964B00'
                WHEN 'Green' THEN '#008000'
                WHEN 'Grey' THEN '#808080'
                WHEN 'Multi-Color' THEN '#808080'
                WHEN 'Orange' THEN '#FFA500'
                WHEN 'Pink' THEN '#FFC0CB'
                WHEN 'Purple' THEN '#800080'
                WHEN 'Red' THEN '#FF0000'
                WHEN 'White' THEN '#FFFFFF'
                WHEN 'Yellow' THEN '#FFFF00'
                ELSE '#808080'
            END,
            p.images,
            0,
            p.created_at,
            p.updated_at
        FROM products p
    """))

    # 3) Add product_color_variant_id to product_variants (nullable first)
    op.add_column('product_variants', sa.Column('product_color_variant_id', sa.String(), nullable=True))

    # 4) Backfill product_color_variant_id from the single color variant per product
    conn.execute(sa.text("""
        UPDATE product_variants pv
        SET product_color_variant_id = pcv.id
        FROM product_color_variants pcv
        WHERE pcv.product_id = pv.product_id
    """))

    # 5) Drop old FK and product_id, make product_color_variant_id NOT NULL and FK
    op.drop_constraint('uq_product_size', 'product_variants', type_='unique')
    op.drop_constraint('product_variants_product_id_fkey', 'product_variants', type_='foreignkey')
    op.drop_column('product_variants', 'product_id')
    op.alter_column('product_variants', 'product_color_variant_id', nullable=False)
    op.create_foreign_key('product_variants_product_color_variant_id_fkey', 'product_variants', 'product_color_variants', ['product_color_variant_id'], ['id'], ondelete='CASCADE')
    op.create_unique_constraint('uq_color_variant_size', 'product_variants', ['product_color_variant_id', 'size'])

    # 6) Drop images and color from products
    op.drop_column('products', 'images')
    op.drop_column('products', 'color')


def downgrade() -> None:
    op.add_column('products', sa.Column('color', sa.String(50), nullable=True))
    op.add_column('products', sa.Column('images', postgresql.ARRAY(sa.String()), nullable=True))

    # Restore product_id on product_variants and backfill from color_variant
    op.add_column('product_variants', sa.Column('product_id', sa.String(), nullable=True))
    conn = op.get_bind()
    conn.execute(sa.text("""
        UPDATE product_variants pv
        SET product_id = pcv.product_id
        FROM product_color_variants pcv
        WHERE pcv.id = pv.product_color_variant_id
    """))
    op.alter_column('product_variants', 'product_id', nullable=False)
    op.drop_constraint('uq_color_variant_size', 'product_variants', type_='unique')
    op.drop_constraint('product_variants_product_color_variant_id_fkey', 'product_variants', type_='foreignkey')
    op.drop_column('product_variants', 'product_color_variant_id')
    op.create_foreign_key('product_variants_product_id_fkey', 'product_variants', 'products', ['product_id'], ['id'], ondelete='CASCADE')
    op.create_unique_constraint('uq_product_size', 'product_variants', ['product_id', 'size'])

    # Restore product.color and product.images from first color variant per product
    conn.execute(sa.text("""
        UPDATE products p
        SET color = pcv.color_name,
            images = pcv.images
        FROM (
            SELECT DISTINCT ON (product_id) product_id, color_name, images
            FROM product_color_variants
            ORDER BY product_id, display_order
        ) pcv
        WHERE pcv.product_id = p.id
    """))

    op.drop_table('product_color_variants')
