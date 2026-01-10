"""add article_number to products

Revision ID: add_article_number
Revises: a1b2c3d4e5f6
Create Date: 2026-01-09 23:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_article_number'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    
    # Add article_number column to products table if it doesn't exist
    if 'article_number' not in products_columns:
        op.add_column('products', sa.Column('article_number', sa.String(50), nullable=True))
        
        # Create unique index on article_number (unique constraint enforced at application level)
        # Note: Unique constraint in model uses unique=True which creates a unique index
        try:
            op.create_index('idx_product_article_number', 'products', ['article_number'], unique=False)
            # Add unique constraint (PostgreSQL creates unique index automatically for unique constraints)
            op.create_unique_constraint('uq_product_article_number', 'products', ['article_number'])
        except Exception:
            # Index/constraint might already exist, skip if so
            pass
    
    # Note: Existing products will have NULL article_number initially
    # They should be populated by running populate_data.py or a separate data migration


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    products_columns = [col['name'] for col in inspector.get_columns('products')]
    
    if 'article_number' in products_columns:
        # Drop unique constraint first (this will drop its associated unique index)
        try:
            op.drop_constraint('uq_product_article_number', 'products', type_='unique')
        except Exception:
            pass
        
        # Drop non-unique index if it exists separately
        try:
            op.drop_index('idx_product_article_number', table_name='products')
        except Exception:
            pass
        
        # Drop column
        op.drop_column('products', 'article_number')
