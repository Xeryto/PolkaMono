"""Add indexes on friendships user_id and friend_id

Revision ID: add_friendship_indexes
Revises: add_fts_trigram_search
"""
from alembic import op

revision = 'add_friendship_indexes'
down_revision = 'add_fts_trigram_search'
branch_labels = None
depends_on = None


def upgrade():
    op.create_index(op.f('ix_friendships_user_id'), 'friendships', ['user_id'], unique=False)
    op.create_index(op.f('ix_friendships_friend_id'), 'friendships', ['friend_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_friendships_friend_id'), table_name='friendships')
    op.drop_index(op.f('ix_friendships_user_id'), table_name='friendships')
