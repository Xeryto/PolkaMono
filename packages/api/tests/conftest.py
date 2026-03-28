"""Test infrastructure: in-memory SQLite DB, fixtures, factories, mocks."""

import os
import sys
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

# ---------------------------------------------------------------------------
# 1. Environment overrides — MUST happen before any app imports
# ---------------------------------------------------------------------------
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["SECRET_KEY"] = "test-secret-key-for-tests"
os.environ["OAUTH_REDIRECT_URL"] = "http://localhost:3000/callback"

# ---------------------------------------------------------------------------
# 2. Monkey-patch postgresql types → SQLite-compatible types
# ---------------------------------------------------------------------------
from sqlalchemy import JSON, Text
from sqlalchemy.dialects import postgresql

postgresql.ARRAY = lambda *a, **kw: JSON()  # type: ignore[assignment]
postgresql.TSVECTOR = Text  # type: ignore[attr-defined]

# ---------------------------------------------------------------------------
# 2b. We'll add a session event listener later (after engine creation)
#     to re-attach UTC tzinfo to naive datetimes loaded from SQLite.
# ---------------------------------------------------------------------------
import sqlalchemy

# Ensure packages/api is on sys.path so bare imports work
API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if API_DIR not in sys.path:
    sys.path.insert(0, API_DIR)

# Ensure tests/ dir is on sys.path so factories.py can be imported
TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
if TESTS_DIR not in sys.path:
    sys.path.insert(0, TESTS_DIR)

# ---------------------------------------------------------------------------
# 3. App imports (after env + ARRAY patch + DateTime patch)
# ---------------------------------------------------------------------------
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import get_db
from models import Base

# Import app last — triggers module-level init
from main import app  # noqa: E402


# ---------------------------------------------------------------------------
# 4. SQLite engine — StaticPool ensures ONE shared in-memory DB
# ---------------------------------------------------------------------------
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ---------------------------------------------------------------------------
# 4b. Attach UTC tzinfo to naive datetimes loaded from SQLite.
#     Postgres returns tz-aware; SQLite strips tzinfo. This listener
#     inspects all DateTime columns on every loaded instance and fixes them.
# ---------------------------------------------------------------------------
from sqlalchemy import inspect as sa_inspect


@event.listens_for(TestingSessionLocal, "loaded_as_persistent")
def _fix_naive_datetimes(session, instance):
    mapper = sa_inspect(type(instance))
    for col in mapper.columns:
        if isinstance(col.type, sqlalchemy.DateTime):
            val = getattr(instance, col.key, None)
            if val is not None and isinstance(val, datetime) and val.tzinfo is None:
                object.__setattr__(instance, col.key, val.replace(tzinfo=timezone.utc))


# ---------------------------------------------------------------------------
# 5. Core fixtures
# ---------------------------------------------------------------------------


def _strip_pg_only_objects(metadata):
    """Neutralise Computed columns and PG-specific indexes so SQLite create_all works."""
    for table in metadata.tables.values():
        # Turn Computed columns into plain nullable columns (keep them so ORM
        # queries don't break — they'll just be NULL in SQLite).
        for col in table.columns:
            if getattr(col, "computed", None) is not None:
                col.computed = None
                col.server_default = None

        # Drop indexes that use postgresql_using (GIN, etc.)
        pg_indexes = [
            idx for idx in table.indexes
            if idx.dialect_options.get("postgresql", {}).get("using")
        ]
        for idx in pg_indexes:
            table.indexes.discard(idx)


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    _strip_pg_only_objects(Base.metadata)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """Raw DB session for direct model manipulation."""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _override_get_db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


app.dependency_overrides[get_db] = _override_get_db

# ---------------------------------------------------------------------------
# 6. Disable rate limiter
# ---------------------------------------------------------------------------
from main import limiter  # noqa: E402

limiter.enabled = False

# ---------------------------------------------------------------------------
# 7. TestClient
# ---------------------------------------------------------------------------
from fastapi.testclient import TestClient  # noqa: E402


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


# ---------------------------------------------------------------------------
# 8. Global mocks (applied for every test)
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def mock_mail(monkeypatch):
    mock = MagicMock(return_value={"status": "ok"})
    monkeypatch.setattr("mail_service.mail_service.send_email", mock)
    monkeypatch.setattr("main.mail_service.send_email", mock)
    return mock


@pytest.fixture(autouse=True)
def mock_notifications(monkeypatch):
    mock = MagicMock()
    monkeypatch.setattr(
        "notification_service.send_brand_new_order_notification", mock
    )
    monkeypatch.setattr(
        "main.notification_service.send_brand_new_order_notification", mock
    )
    shipped_mock = MagicMock()
    monkeypatch.setattr(
        "notification_service.send_buyer_shipped_notification", shipped_mock
    )
    monkeypatch.setattr(
        "main.notification_service.send_buyer_shipped_notification", shipped_mock
    )
    return mock


@pytest.fixture(autouse=True)
def mock_yookassa(monkeypatch):
    """Mock YooKassa Payment.create to avoid real API calls."""
    mock_payment = MagicMock()
    mock_payment.id = str(uuid.uuid4())
    mock_payment.status = "pending"
    mock_payment.amount = MagicMock(value="1000.00", currency="RUB")
    mock_payment.confirmation = MagicMock(
        confirmation_url="https://yookassa.test/pay/123"
    )

    mock_create = MagicMock(return_value=mock_payment)
    monkeypatch.setattr("payment_service.Payment.create", mock_create)
    return mock_create
