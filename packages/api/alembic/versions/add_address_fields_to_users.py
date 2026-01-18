"""add street house_number apartment_number to users and drop address column

Revision ID: add_address_fields
Revises: add_article_number
Create Date: 2026-01-09 23:45:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_address_fields'
down_revision = 'add_article_number'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Add street column to users table if it doesn't exist
    if 'street' not in users_columns:
        op.add_column('users', sa.Column('street', sa.String(255), nullable=True))
    
    # Add house_number column to users table if it doesn't exist
    if 'house_number' not in users_columns:
        op.add_column('users', sa.Column('house_number', sa.String(50), nullable=True))
    
    # Add apartment_number column to users table if it doesn't exist
    if 'apartment_number' not in users_columns:
        op.add_column('users', sa.Column('apartment_number', sa.String(50), nullable=True))
    
    # Drop address column if it exists (replaced by street, house_number, apartment_number)
    if 'address' in users_columns:
        op.drop_column('users', 'address')


def downgrade():
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Re-add address column in downgrade
    if 'address' not in users_columns:
        op.add_column('users', sa.Column('address', sa.Text, nullable=True))
    
    if 'apartment_number' in users_columns:
        op.drop_column('users', 'apartment_number')
    
    if 'house_number' in users_columns:
        op.drop_column('users', 'house_number')
    
    if 'street' in users_columns:
        op.drop_column('users', 'street')
