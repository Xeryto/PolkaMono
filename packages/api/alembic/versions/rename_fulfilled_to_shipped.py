"""rename order_items status fulfilled to shipped

Revision ID: rename_fulfilled_shipped
Revises: 8be520a3f904
Create Date: 2026-03-01

"""
from alembic import op
from sqlalchemy import text


revision = "rename_fulfilled_shipped"
down_revision = "8be520a3f904"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(text("UPDATE order_items SET status = 'shipped' WHERE status = 'fulfilled'"))


def downgrade():
    op.execute(text("UPDATE order_items SET status = 'fulfilled' WHERE status = 'shipped'"))
