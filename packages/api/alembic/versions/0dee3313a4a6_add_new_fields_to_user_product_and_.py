"""Add new fields to User, Product, and Order models, remove tracking_number from OrderItem

Revision ID: 0dee3313a4a6
Revises: 68a5aa22da34
Create Date: 2025-09-04 11:21:59.146906

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '0dee3313a4a6'
down_revision = '68a5aa22da34'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('return_policy', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('sku', sa.String(length=255), nullable=True))
    op.add_column('products', sa.Column('color', sa.String(length=50), nullable=True))
    op.add_column('products', sa.Column('material', sa.String(length=100), nullable=True))
    op.add_column('products', sa.Column('hashtags', sa.ARRAY(sa.String()), nullable=True))
    op.add_column('products', sa.Column('honest_sign', sa.String(length=255), nullable=True))
    op.create_unique_constraint('uq_products_honest_sign', 'products', ['honest_sign'])

def downgrade() -> None:
    op.drop_constraint('uq_products_honest_sign', 'products', type_='unique')
    op.drop_column('products', 'honest_sign')
    op.drop_column('products', 'hashtags')
    op.drop_column('products', 'material')
    op.drop_column('products', 'color')
    op.drop_column('products', 'sku')
    op.drop_column('products', 'return_policy') 