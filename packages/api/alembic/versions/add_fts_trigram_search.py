"""Add FTS and trigram search indexes to products

Revision ID: add_fts_trigram_search
Revises: convert_to_timestamptz
"""
from alembic import op

revision = 'add_fts_trigram_search'
down_revision = 'convert_to_timestamptz'
branch_labels = None
depends_on = None


def upgrade():
    # Enable pg_trgm extension for fuzzy/trigram matching
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    # Add generated tsvector column for full-text search
    op.execute("""
        ALTER TABLE products
        ADD COLUMN search_vector tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('russian', coalesce(name, '')), 'A') ||
            setweight(to_tsvector('russian', coalesce(description, '')), 'B')
        ) STORED
    """)

    # GIN index on tsvector column for fast FTS queries
    op.execute("""
        CREATE INDEX idx_products_search_vector
        ON products USING GIN (search_vector)
    """)

    # GIN trigram indexes for fuzzy matching
    op.execute("""
        CREATE INDEX idx_products_name_trgm
        ON products USING GIN (name gin_trgm_ops)
    """)
    op.execute("""
        CREATE INDEX idx_products_description_trgm
        ON products USING GIN (description gin_trgm_ops)
    """)


def downgrade():
    op.execute("DROP INDEX IF EXISTS idx_products_description_trgm")
    op.execute("DROP INDEX IF EXISTS idx_products_name_trgm")
    op.execute("DROP INDEX IF EXISTS idx_products_search_vector")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS search_vector")
