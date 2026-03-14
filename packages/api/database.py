"""
Database connection and session management
"""
from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from config import settings
from models import Base

# Create database engine
engine = create_engine(
    settings.get_database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=settings.DEBUG
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize database tables"""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.commit()
    Base.metadata.create_all(bind=engine)

def drop_db():
    """Drop all database tables"""
    Base.metadata.drop_all(bind=engine) 