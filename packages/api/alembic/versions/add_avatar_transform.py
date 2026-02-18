"""Add avatar_transform to user_profiles (device-independent scale + translatePercent)

Revision ID: avatar_transform
Revises: avatar_full_crop
Create Date: 2026-02-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = "avatar_transform"
down_revision = "avatar_full_crop"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("user_profiles")]
    if "avatar_transform" not in cols:
        op.add_column(
            "user_profiles",
            sa.Column("avatar_transform", sa.String(500), nullable=True),
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)
    cols = [c["name"] for c in inspector.get_columns("user_profiles")]
    if "avatar_transform" in cols:
        op.drop_column("user_profiles", "avatar_transform")
