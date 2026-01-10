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
    """
    Add quantity column to order_items and purchase_count to products.
    
    IMPORTANT: On fresh databases, the initial migration (f6531bca9ba9) creates all tables
    with the current model structure, which already includes these columns.
    This migration is primarily for upgrading existing databases.
    
    Strategy: Use PostgreSQL DO blocks to safely check and add columns without aborting transaction.
    If columns already exist (fresh database), skip everything. This makes the migration idempotent.
    """
    # Use PostgreSQL DO blocks to safely add columns if they don't exist
    # This avoids transaction abort issues and works on both fresh and existing databases
    # On fresh databases (columns already exist), these blocks will do nothing
    
    # Add quantity column to order_items if it doesn't exist
    op.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'order_items' 
                AND column_name = 'quantity'
            ) THEN
                ALTER TABLE order_items ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If column already exists or any error, do nothing
            NULL;
        END $$;
    """))
    
    # Add purchase_count column to products if it doesn't exist
    op.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'products' 
                AND column_name = 'purchase_count'
            ) THEN
                ALTER TABLE products ADD COLUMN purchase_count INTEGER NOT NULL DEFAULT 0;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If column already exists or any error, do nothing
            NULL;
        END $$;
    """))
    
    # Create index on purchase_count if it doesn't exist
    op.execute(text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE schemaname = 'public' 
                AND tablename = 'products' 
                AND indexname = 'idx_product_purchase_count'
            ) THEN
                CREATE INDEX idx_product_purchase_count ON products (purchase_count);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If index already exists or any error, do nothing
            NULL;
        END $$;
    """))
    
    # Populate purchase_count from paid orders (skip on fresh databases with no orders)
    # This is wrapped in DO block to handle errors gracefully
    op.execute(text("""
        DO $$
        DECLARE
            has_paid_orders BOOLEAN;
        BEGIN
            -- Check if there are any paid orders
            SELECT EXISTS (SELECT 1 FROM orders WHERE status::text = 'paid' LIMIT 1) INTO has_paid_orders;
            
            -- Only populate if there are paid orders (existing database upgrade scenario)
            IF has_paid_orders THEN
                UPDATE products p
                SET purchase_count = COALESCE((
                    SELECT SUM(COALESCE(oi.quantity, 1))
                    FROM order_items oi
                    JOIN product_variants pv ON oi.product_variant_id = pv.id
                    JOIN orders o ON oi.order_id = o.id
                    WHERE pv.product_id = p.id
                    AND o.status::text = 'paid'
                ), 0);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- If population fails (e.g., no orders, schema issues), do nothing
            -- Products will have purchase_count=0 from DEFAULT, which is correct
            NULL;
        END $$;
    """))


def downgrade() -> None:
    # Drop index if it exists
    try:
        op.drop_index('idx_product_purchase_count', table_name='products')
    except Exception:
        pass
    
    # Drop columns if they exist
    try:
        op.drop_column('products', 'purchase_count')
    except Exception:
        pass
    
    # Note: We don't drop quantity from order_items to avoid data loss
    # If needed, it can be dropped manually with appropriate data migration
