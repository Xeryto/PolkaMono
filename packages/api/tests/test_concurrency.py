"""
Concurrency tests for stock management.

These tests require a real PostgreSQL connection to exercise SELECT FOR UPDATE.
They are skipped if TEST_DATABASE_URL is not set (i.e. local dev without PG).
CI provides a postgres service container and sets this env var.
"""

import os
import threading
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from auth_service import auth_service
from database import get_db
from factories import create_test_brand_with_product, create_test_user
from main import app
from models import (
    AuthAccount,
    Base,
    Brand,
    Checkout,
    Order,
    OrderItem,
    OrderStatus,
    ProductVariant,
    User,
    UserProfile,
    UserShippingInfo,
)

# ---------------------------------------------------------------------------
# Skip everything if no real PG is available
# ---------------------------------------------------------------------------
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL not set — skipping concurrency tests",
)

# ---------------------------------------------------------------------------
# PG engine / session factory
# ---------------------------------------------------------------------------
if TEST_DATABASE_URL:
    pg_engine = create_engine(
        TEST_DATABASE_URL,
        poolclass=NullPool,  # no connection reuse — each thread gets its own conn
    )
    PgSession = sessionmaker(autocommit=False, autoflush=False, bind=pg_engine)
else:
    pg_engine = None
    PgSession = None


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module", autouse=True)
def pg_schema():
    """Create / drop all tables once for the whole module."""
    if pg_engine is None:
        return
    with pg_engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gin"))
        conn.commit()
    Base.metadata.create_all(bind=pg_engine)
    # search_vector is TSVECTOR GENERATED ALWAYS in prod but patched to Text here;
    # drop the generated expression so plain inserts work in tests.
    with pg_engine.connect() as conn:
        conn.execute(text("ALTER TABLE products ALTER COLUMN search_vector DROP EXPRESSION IF EXISTS"))
        conn.commit()
    yield
    Base.metadata.drop_all(bind=pg_engine)


@pytest.fixture()
def pg_db():
    """Fresh PG session per test, always rolled back."""
    if PgSession is None:
        pytest.skip("No PG session")
    session = PgSession()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


def _make_pg_user(db):
    """Create a minimal User with shipping info in PG."""
    email = f"user-{uuid.uuid4().hex[:8]}@pg.test"
    auth = AuthAccount(
        id=str(uuid.uuid4()),
        email=email,
        password_hash=auth_service.hash_password("TestPass1"),
        is_email_verified=True,
    )
    db.add(auth)
    db.flush()

    user = User(id=str(uuid.uuid4()), username=f"user_{uuid.uuid4().hex[:8]}", auth_account_id=auth.id)
    db.add(user)
    db.flush()

    db.add(UserProfile(id=str(uuid.uuid4()), user_id=user.id, full_name="PG Test User"))
    db.add(
        UserShippingInfo(
            id=str(uuid.uuid4()),
            user_id=user.id,
            delivery_email=email,
            phone="+71234567890",
            street="Тестовая",
            house_number="1",
            city="Москва",
            postal_code="123456",
        )
    )
    db.commit()
    db.refresh(user)
    return user


def _make_pg_brand_product(db, stock):
    """Create Brand + Product + Variant in PG and return (brand, product, variant)."""
    from models import Category, Product, ProductColorVariant

    auth = AuthAccount(
        id=str(uuid.uuid4()),
        email=f"brand-{uuid.uuid4().hex[:8]}@pg.test",
        password_hash=auth_service.hash_password("BrandPass1"),
        is_email_verified=True,
    )
    db.add(auth)
    db.flush()

    brand = Brand(
        id=str(uuid.uuid4()),
        name=f"Brand_{uuid.uuid4().hex[:6]}",
        auth_account_id=auth.id,
        slug=f"brand-{uuid.uuid4().hex[:6]}",
        shipping_price=350.0,
        min_free_shipping=5000,
    )
    db.add(brand)
    db.flush()

    cat = db.query(Category).filter(Category.id == "pg-test-cat").first()
    if not cat:
        cat = Category(id="pg-test-cat", name="PG Test Category")
        db.add(cat)
        db.flush()

    product = Product(
        id=str(uuid.uuid4()),
        name=f"Product_{uuid.uuid4().hex[:6]}",
        price=1000.0,
        brand_id=brand.id,
        category_id=cat.id,
        purchase_count=0,
        general_images=["https://img.test/1.jpg"],
    )
    db.add(product)
    db.flush()

    cv = ProductColorVariant(
        id=str(uuid.uuid4()),
        product_id=product.id,
        color_name="Black",
        color_hex="#000000",
        images=["https://img.test/black.jpg"],
    )
    db.add(cv)
    db.flush()

    variant = ProductVariant(
        id=str(uuid.uuid4()),
        product_color_variant_id=cv.id,
        size="M",
        stock_quantity=stock,
    )
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return brand, product, variant


def _thread_session():
    """Session for concurrent threads: 10s lock_timeout so tests fail instead of hanging."""
    db = PgSession()
    db.execute(text("SET LOCAL lock_timeout = '10s'"))
    return db


def _direct_order(db, user, brand, variant_id, qty=1):
    """Create Order + OrderItem directly, with locking — mirrors create_payment logic."""
    locked = (
        db.query(ProductVariant)
        .with_for_update()
        .filter(ProductVariant.id == variant_id)
        .first()
    )
    if locked.stock_quantity < qty:
        raise ValueError(f"Insufficient stock: {locked.stock_quantity} < {qty}")

    locked.stock_quantity -= qty

    order = Order(
        user_id=user.id,
        order_number=str(uuid.uuid4().hex[:5]),
        total_amount=1000.0 * qty,
        status=OrderStatus.CREATED,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
        brand_id=brand.id,
    )
    db.add(order)
    db.flush()

    db.add(
        OrderItem(
            order_id=order.id,
            product_variant_id=variant_id,
            quantity=qty,
            price=1000.0,
        )
    )
    db.commit()
    return order


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestConcurrentStock:
    def test_two_threads_last_item_only_one_wins(self):
        """stock=1, two concurrent orders — exactly one should succeed."""
        setup_db = PgSession()
        user = _make_pg_user(setup_db)
        brand, _, variant = _make_pg_brand_product(setup_db, stock=1)
        variant_id = variant.id
        setup_db.close()

        successes = []
        errors = []

        def attempt_order():
            db = _thread_session()
            try:
                # Re-fetch user and brand in this session
                u = db.query(User).filter(User.id == user.id).first()
                b = db.query(Brand).filter(Brand.id == brand.id).first()
                order = _direct_order(db, u, b, variant_id)
                successes.append(order.id)
            except Exception as e:
                errors.append(str(e))
            finally:
                db.close()

        t1 = threading.Thread(target=attempt_order)
        t2 = threading.Thread(target=attempt_order)
        t1.start()
        t2.start()
        t1.join(timeout=30)
        t2.join(timeout=30)
        assert not t1.is_alive() and not t2.is_alive(), "Threads timed out (possible deadlock)"

        assert len(successes) == 1, f"Expected 1 success, got {len(successes)}: {successes}"
        assert len(errors) == 1, f"Expected 1 error, got {len(errors)}: {errors}"

        # Final stock must be 0
        verify_db = PgSession()
        v = verify_db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
        assert v.stock_quantity == 0
        verify_db.close()

    def test_stock_never_goes_negative(self):
        """stock=2, three concurrent orders of qty=1 — only two succeed."""
        setup_db = PgSession()
        user = _make_pg_user(setup_db)
        brand, _, variant = _make_pg_brand_product(setup_db, stock=2)
        variant_id = variant.id
        setup_db.close()

        successes = []
        errors = []
        lock = threading.Lock()

        def attempt():
            db = _thread_session()
            try:
                u = db.query(User).filter(User.id == user.id).first()
                b = db.query(Brand).filter(Brand.id == brand.id).first()
                order = _direct_order(db, u, b, variant_id)
                with lock:
                    successes.append(order.id)
            except Exception as e:
                with lock:
                    errors.append(str(e))
            finally:
                db.close()

        threads = [threading.Thread(target=attempt) for _ in range(3)]
        for t in threads:
            t.start()
        for t in threads:
            t.join(timeout=30)
        assert all(not t.is_alive() for t in threads), "Threads timed out (possible deadlock)"

        assert len(successes) == 2, f"Expected 2 successes, got {len(successes)}: errors={errors}"
        assert len(errors) == 1, f"Expected 1 error, got {len(errors)}: errors={errors}"

        verify_db = PgSession()
        v = verify_db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
        assert v.stock_quantity == 0
        verify_db.close()

    def test_cancel_restores_stock_under_concurrency(self):
        """Cancel one order while another order is being placed — stock stays consistent."""
        import payment_service

        setup_db = PgSession()
        user = _make_pg_user(setup_db)
        brand, _, variant = _make_pg_brand_product(setup_db, stock=1)
        brand_id = brand.id
        variant_id = variant.id

        # Create an existing CREATED order that holds the last unit
        existing_order = _direct_order(setup_db, user, brand, variant_id)
        existing_order_id = existing_order.id
        setup_db.close()

        # stock is now 0; cancel restores it; a new order should then succeed
        results = {}
        errors = {}

        def cancel_existing():
            db = _thread_session()
            try:
                payment_service.update_order_status(
                    db, existing_order_id, OrderStatus.CANCELED, actor_type="user"
                )
                db.commit()
                results["cancel"] = "ok"
            except Exception as e:
                errors["cancel"] = str(e)
            finally:
                db.close()

        def place_new():
            import time
            time.sleep(0.05)  # small delay so cancel likely runs first
            db = _thread_session()
            try:
                u = db.query(User).filter(User.id == user.id).first()
                b = db.query(Brand).filter(Brand.id == brand_id).first()
                order = _direct_order(db, u, b, variant_id)
                results["new_order"] = order.id
            except Exception as e:
                errors["new_order"] = str(e)
            finally:
                db.close()

        t1 = threading.Thread(target=cancel_existing)
        t2 = threading.Thread(target=place_new)
        t1.start()
        t2.start()
        t1.join(timeout=30)
        t2.join(timeout=30)
        assert not t1.is_alive() and not t2.is_alive(), "Threads timed out (possible deadlock)"

        # cancel must succeed
        assert "cancel" in results, f"Cancel failed: {errors.get('cancel')}"

        # Either new order succeeded (cancel ran first) OR it failed with insufficient stock
        # (new order ran before cancel) — both are correct outcomes. What's NOT ok is a panic.
        verify_db = PgSession()
        v = verify_db.query(ProductVariant).filter(ProductVariant.id == variant_id).first()
        # Stock must be 0 (new order grabbed it) or 1 (cancel restored, new order didn't run)
        assert v.stock_quantity >= 0, "Stock went negative!"
        verify_db.close()
