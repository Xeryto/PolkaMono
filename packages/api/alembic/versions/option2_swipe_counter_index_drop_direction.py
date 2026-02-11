"""Option 2 groundwork: items_swiped counter, composite index for recent swipes, drop swipe_direction

Revision ID: option2_swipe_grounds
Revises: add_user_deleted_at
Create Date: 2026-02-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision = 'option2_swipe_grounds'
down_revision = 'add_user_deleted_at'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # 1. Add items_swiped counter to users (for stats without COUNT on user_swipes)
    users_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'items_swiped' not in users_cols:
        op.add_column(
            'users',
            sa.Column('items_swiped', sa.Integer(), nullable=False, server_default='0'),
        )
        # Backfill from current swipe counts
        conn.execute(text("""
            UPDATE users u
            SET items_swiped = c.cnt
            FROM (
                SELECT user_id, COUNT(*) AS cnt
                FROM user_swipes
                GROUP BY user_id
            ) c
            WHERE u.id = c.user_id
        """))

    # 2. Composite index on user_swipes for "last N swipes per user"
    indexes = [i['name'] for i in inspector.get_indexes('user_swipes')]
    if 'idx_user_swipes_user_id' in indexes:
        op.drop_index('idx_user_swipes_user_id', table_name='user_swipes')
    if 'idx_user_swipes_created_at' in indexes:
        op.drop_index('idx_user_swipes_created_at', table_name='user_swipes')
    if 'idx_user_swipes_user_created' not in indexes:
        op.create_index(
            'idx_user_swipes_user_created',
            'user_swipes',
            ['user_id', 'created_at'],
            unique=False,
        )

    # 3. Drop swipe_direction (no longer used)
    swipe_cols = [c['name'] for c in inspector.get_columns('user_swipes')]
    if 'swipe_direction' in swipe_cols:
        op.drop_column('user_swipes', 'swipe_direction')


def downgrade() -> None:
    conn = op.get_bind()
    inspector = inspect(conn)

    # 3. Restore swipe_direction
    swipe_cols = [c['name'] for c in inspector.get_columns('user_swipes')]
    if 'swipe_direction' not in swipe_cols:
        op.add_column(
            'user_swipes',
            sa.Column('swipe_direction', sa.String(10), nullable=True),
        )
        op.execute(text("UPDATE user_swipes SET swipe_direction = 'up' WHERE swipe_direction IS NULL"))
        op.alter_column(
            'user_swipes', 'swipe_direction',
            existing_type=sa.String(10),
            nullable=False,
        )

    # 2. Drop composite index, restore single-column indexes
    indexes = [i['name'] for i in inspector.get_indexes('user_swipes')]
    if 'idx_user_swipes_user_created' in indexes:
        op.drop_index('idx_user_swipes_user_created', table_name='user_swipes')
    if 'idx_user_swipes_user_id' not in indexes:
        op.create_index('idx_user_swipes_user_id', 'user_swipes', ['user_id'], unique=False)
    if 'idx_user_swipes_created_at' not in indexes:
        op.create_index('idx_user_swipes_created_at', 'user_swipes', ['created_at'], unique=False)

    # 1. Remove items_swiped from users
    users_cols = [c['name'] for c in inspector.get_columns('users')]
    if 'items_swiped' in users_cols:
        op.drop_column('users', 'items_swiped')
