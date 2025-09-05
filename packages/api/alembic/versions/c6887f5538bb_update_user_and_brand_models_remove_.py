"""Update User and Brand models, remove tracking_number from OrderItem

Revision ID: c6887f5538bb
Revises: 0dee3313a4a6
Create Date: 2025-09-04 11:44:42.590766

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c6887f5538bb'
down_revision = '0dee3313a4a6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 