"""add_purchase_count_to_products_and_quantity_to_order_items

Revision ID: d5dfbf9ece1c
Revises: c8cc04d6469c
Create Date: 2026-01-09 22:05:21.232724

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision = 'd5dfbf9ece1c'
down_revision = 'c8cc04d6469c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add quantity column to order_items if it doesn't exist
    # Check if column exists first to avoid errors if already migrated
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('order_items')]
    
    if 'quantity' not in columns:
        op.add_column('order_items', sa.Column('quantity', sa.Integer(), nullable=False, server_default='1'))
    
    # Add purchase_count column to products table
    if 'purchase_count' not in [col['name'] for col in inspector.get_columns('products')]:
        op.add_column('products', sa.Column('purchase_count', sa.Integer(), nullable=False, server_default='0'))
    
    # Create index on purchase_count for efficient sorting
    try:
        op.create_index('idx_product_purchase_count', 'products', ['purchase_count'])
    except Exception:
        # Index might already exist, skip if so
        pass
    
    # Populate initial purchase_count from existing PAID orders
    # Count OrderItems grouped by Product (through ProductVariant) where Order.status = PAID
    # Sum the quantities for each product (use COALESCE to handle missing quantity field gracefully)
    # PostgreSQL enums are case-sensitive: use the enum name 'PAID' (uppercase) directly
    # Cast to text for comparison to avoid enum casting issues
    populate_query = text("""
        UPDATE products p
        SET purchase_count = COALESCE((
            SELECT SUM(COALESCE(oi.quantity, 1))
            FROM order_items oi
            JOIN product_variants pv ON oi.product_variant_id = pv.id
            JOIN orders o ON oi.order_id = o.id
            WHERE pv.product_id = p.id
            AND o.status::text = 'PAID'
        ), 0)
    """)
    conn.execute(populate_query)
    # Alembic handles transaction commits automatically, no need for manual commit


def downgrade() -> None:
    # Drop index
    try:
        op.drop_index('idx_product_purchase_count', table_name='products')
    except Exception:
        pass
    
    # Drop columns
    op.drop_column('products', 'purchase_count')
    
    # Note: We don't drop quantity from order_items to avoid data loss
    # If needed, it can be dropped manually with appropriate data migration 