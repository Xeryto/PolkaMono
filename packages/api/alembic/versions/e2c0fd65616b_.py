"""empty message

Revision ID: e2c0fd65616b
Revises: add_brand_inn_payout, add_order_shipped_returned
Create Date: 2026-02-18 04:12:52.441950

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e2c0fd65616b'
down_revision = ('add_brand_inn_payout', 'add_order_shipped_returned')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass 