"""add country_of_manufacture to products

Revision ID: e55d123a262d
Revises: 09b_brand_uuid
Create Date: 2026-02-25 18:10:53.853591

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e55d123a262d'
down_revision = '09b_brand_uuid'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('country_of_manufacture', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'country_of_manufacture') 