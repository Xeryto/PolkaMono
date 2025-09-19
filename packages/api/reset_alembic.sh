#!/bin/bash

# Script to reset Alembic migrations completely

echo "🔄 Resetting Alembic migrations..."

# 1. Remove all existing migration files
echo "📁 Removing existing migration files..."
rm -f alembic/versions/*.py

# 2. Drop the alembic_version table to reset migration history
echo "🗑️  Dropping alembic_version table..."
python -c "
from database import engine
with engine.connect() as conn:
    conn.execute('DROP TABLE IF EXISTS alembic_version CASCADE;')
    conn.commit()
print('Alembic version table dropped')
"

# 3. Create a new initial migration
echo "🆕 Creating new initial migration..."
alembic revision --autogenerate -m "Initial migration from current models"

# 4. Apply the new migration
echo "⬆️  Applying new migration..."
alembic upgrade head

echo "✅ Alembic reset complete!"
