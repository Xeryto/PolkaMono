"""rename honest_sign to sku and remove product sku

Revision ID: a1b2c3d4e5f6
Revises: d5dfbf9ece1c
Create Date: 2026-01-09 23:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'd5dfbf9ece1c'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check if honest_sign column exists in order_items before renaming
    order_items_columns = [col['name'] for col in inspector.get_columns('order_items')]
    if 'honest_sign' in order_items_columns and 'sku' not in order_items_columns:
        # Rename honest_sign column to sku in order_items table
        op.alter_column('order_items', 'honest_sign',
                        new_column_name='sku',
                        existing_type=sa.String(255),
                        existing_nullable=True)
    
    # Check if sku column exists in products before dropping
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    if 'sku' in products_columns:
        # Drop the sku column from products table (SKU should only be on OrderItems)
        op.drop_column('products', 'sku')


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    
    # Check if sku column exists in order_items before renaming back
    order_items_columns = [col['name'] for col in inspector.get_columns('order_items')]
    if 'sku' in order_items_columns and 'honest_sign' not in order_items_columns:
        # Rename sku column back to honest_sign in order_items table
        op.alter_column('order_items', 'sku',
                        new_column_name='honest_sign',
                        existing_type=sa.String(255),
                        existing_nullable=True)
    
    # Check if sku column doesn't exist in products before adding
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    if 'sku' not in products_columns:
        # Re-add sku column to products table
        op.add_column('products',
                      sa.Column('sku', sa.String(255), nullable=True))
