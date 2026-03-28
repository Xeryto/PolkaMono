"""Tests for background scheduler job logic: order expiry and brand purge."""

import uuid
from datetime import datetime, timedelta, timezone

from freezegun import freeze_time

import payment_service
from factories import create_order_in_db, create_test_brand_with_product, create_test_user
from models import (
    AuthAccount,
    Brand,
    OrderStatus,
    ProductColorVariant,
    UserBrand,
    UserLikedProduct,
    UserSwipe,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _past(hours=2):
    return datetime.now(timezone.utc) - timedelta(hours=hours)


def _future(hours=2):
    return datetime.now(timezone.utc) + timedelta(hours=hours)


def _create_brand_for_deletion(db, scheduled_deletion_at=None):
    """Create a brand with an auth account and optional scheduled_deletion_at."""
    brand_email = f"brand-{uuid.uuid4().hex[:8]}@test.com"
    auth = AuthAccount(
        id=str(uuid.uuid4()),
        email=brand_email,
        password_hash="hashed",
        is_email_verified=True,
        otp_code="123456",
        refresh_token_hash="tok",
        password_history=["old_hash"],
    )
    db.add(auth)
    db.flush()

    brand = Brand(
        id=str(uuid.uuid4()),
        name=f"Brand_{uuid.uuid4().hex[:6]}",
        auth_account_id=auth.id,
        slug=f"brand-{uuid.uuid4().hex[:6]}",
        scheduled_deletion_at=scheduled_deletion_at,
        inn="1234567890",
        contact_phone="+71234567890",
    )
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


# ---------------------------------------------------------------------------
# expire_pending_orders
# ---------------------------------------------------------------------------


class TestExpirePendingOrders:
    def test_expired_order_is_canceled(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=5)
        order = create_order_in_db(db, user, brand, variant, expires_at=_past())

        count = payment_service.expire_pending_orders(db)

        assert count == 1
        db.refresh(order)
        assert order.status == OrderStatus.CANCELED

    def test_expired_order_restores_stock(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=5)
        original_stock = variant.stock_quantity  # 5
        create_order_in_db(db, user, brand, variant, expires_at=_past())  # stock → 4
        db.refresh(variant)
        assert variant.stock_quantity == original_stock - 1  # confirm decrement

        payment_service.expire_pending_orders(db)

        db.refresh(variant)
        assert variant.stock_quantity == original_stock  # restored to 5

    def test_non_expired_order_untouched(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=5)
        order = create_order_in_db(db, user, brand, variant, expires_at=_future())

        count = payment_service.expire_pending_orders(db)

        assert count == 0
        db.refresh(order)
        assert order.status == OrderStatus.CREATED

    def test_paid_order_not_expired(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=5)
        order = create_order_in_db(
            db, user, brand, variant, expires_at=_past(), status=OrderStatus.PAID
        )

        count = payment_service.expire_pending_orders(db)

        assert count == 0
        db.refresh(order)
        assert order.status == OrderStatus.PAID

    def test_order_without_expires_at_untouched(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=5)
        order = create_order_in_db(db, user, brand, variant, expires_at=None)
        # Override expires_at to None after creation
        order.expires_at = None
        db.commit()

        count = payment_service.expire_pending_orders(db)

        assert count == 0
        db.refresh(order)
        assert order.status == OrderStatus.CREATED

    def test_mixed_orders_only_eligible_canceled(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=10)

        expired = create_order_in_db(db, user, brand, variant, expires_at=_past())
        future_order = create_order_in_db(db, user, brand, variant, expires_at=_future())
        paid_order = create_order_in_db(
            db, user, brand, variant, expires_at=_past(), status=OrderStatus.PAID
        )

        count = payment_service.expire_pending_orders(db)

        assert count == 1
        db.refresh(expired)
        db.refresh(future_order)
        db.refresh(paid_order)
        assert expired.status == OrderStatus.CANCELED
        assert future_order.status == OrderStatus.CREATED
        assert paid_order.status == OrderStatus.PAID

    def test_returns_correct_count(self, db):
        user = create_test_user(db)
        brand, _, variant = create_test_brand_with_product(db, stock=10)

        for _ in range(3):
            create_order_in_db(db, user, brand, variant, expires_at=_past())

        count = payment_service.expire_pending_orders(db)
        assert count == 3


# ---------------------------------------------------------------------------
# purge_deleted_brands
# ---------------------------------------------------------------------------


class TestPurgeDeletedBrands:
    def test_brand_past_deletion_date_is_anonymized(self, db):
        brand = _create_brand_for_deletion(db, scheduled_deletion_at=_past())

        count = payment_service.purge_deleted_brands(db)

        assert count == 1
        db.refresh(brand)
        assert brand.name == f"deleted_{brand.id}"
        assert brand.slug == f"deleted_{brand.id}"
        assert brand.inn is None
        assert brand.contact_phone is None
        assert brand.logo is None
        assert brand.description is None

    def test_auth_account_anonymized(self, db):
        brand = _create_brand_for_deletion(db, scheduled_deletion_at=_past())
        auth_id = brand.auth_account.id

        payment_service.purge_deleted_brands(db)

        db.expire_all()
        acc = db.query(AuthAccount).filter(AuthAccount.id == auth_id).first()
        assert acc.email == f"deleted_brand_{brand.id}@anonymized.local"
        assert acc.password_hash is None
        assert acc.otp_code is None
        assert acc.refresh_token_hash is None
        assert acc.password_history == []

    def test_brand_not_yet_due_is_untouched(self, db):
        brand = _create_brand_for_deletion(db, scheduled_deletion_at=_future())
        original_name = brand.name

        count = payment_service.purge_deleted_brands(db)

        assert count == 0
        db.refresh(brand)
        assert brand.name == original_name

    def test_brand_with_no_deletion_date_untouched(self, db):
        brand = _create_brand_for_deletion(db, scheduled_deletion_at=None)
        original_name = brand.name

        count = payment_service.purge_deleted_brands(db)

        assert count == 0
        db.refresh(brand)
        assert brand.name == original_name

    def test_associated_product_data_cleaned_up(self, db):
        user = create_test_user(db)
        brand, product, variant = create_test_brand_with_product(db, stock=5)
        brand.scheduled_deletion_at = _past()
        db.commit()

        # Add interactions
        like = UserLikedProduct(user_id=user.id, product_id=product.id)
        swipe = UserSwipe(user_id=user.id, product_id=product.id)
        ub = UserBrand(user_id=user.id, brand_id=brand.id)
        db.add_all([like, swipe, ub])
        db.commit()

        payment_service.purge_deleted_brands(db)
        db.expire_all()

        assert db.query(UserLikedProduct).filter(UserLikedProduct.product_id == product.id).count() == 0
        assert db.query(UserSwipe).filter(UserSwipe.product_id == product.id).count() == 0
        assert db.query(UserBrand).filter(UserBrand.brand_id == brand.id).count() == 0

    def test_product_stock_zeroed_and_images_nulled(self, db):
        brand, product, variant = create_test_brand_with_product(db, stock=10)
        brand.scheduled_deletion_at = _past()
        db.commit()

        payment_service.purge_deleted_brands(db)
        db.expire_all()

        db.refresh(variant)
        assert variant.stock_quantity == 0

        cv = db.query(ProductColorVariant).filter(
            ProductColorVariant.product_id == product.id
        ).first()
        assert cv.images is None

    def test_multiple_brands_purged(self, db):
        b1 = _create_brand_for_deletion(db, scheduled_deletion_at=_past())
        b2 = _create_brand_for_deletion(db, scheduled_deletion_at=_past())
        b3 = _create_brand_for_deletion(db, scheduled_deletion_at=_future())

        count = payment_service.purge_deleted_brands(db)

        assert count == 2
        db.refresh(b1)
        db.refresh(b2)
        db.refresh(b3)
        assert b1.name.startswith("deleted_")
        assert b2.name.startswith("deleted_")
        assert not b3.name.startswith("deleted_")

    def test_no_brands_due_returns_zero(self, db):
        count = payment_service.purge_deleted_brands(db)
        assert count == 0

    @freeze_time("2025-01-01 12:00:00")
    def test_boundary_exactly_at_deletion_time_is_purged(self, db):
        deletion_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        brand = _create_brand_for_deletion(db, scheduled_deletion_at=deletion_time)

        count = payment_service.purge_deleted_brands(db)

        assert count == 1
        db.refresh(brand)
        assert brand.name.startswith("deleted_")
