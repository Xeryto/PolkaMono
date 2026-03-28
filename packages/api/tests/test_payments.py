"""Order lifecycle, stock integrity, webhooks (17 tests)."""

import json
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from factories import (
    auth_header as _auth,
    create_order_in_db,
    create_test_brand_with_product,
    create_test_user,
    make_token,
)
from models import Order, OrderStatus, Product, ProductVariant


def _make_order(client, token, variant_id, qty=1, amount=1000.0):
    return client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": amount, "currency": "RUB"},
            "description": "test order",
            "items": [{"product_variant_id": variant_id, "quantity": qty}],
        },
    )


# ---------- Happy path ----------


def test_create_test_order_success(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db)
    token = make_token(user)
    resp = _make_order(client, token, variant.id, qty=1, amount=product.price + 350)
    assert resp.status_code == 200
    assert "order_id" in resp.json()
    checkout_id = resp.json()["order_id"]
    order = db.query(Order).filter(Order.checkout_id == checkout_id).first()
    assert order.status == OrderStatus.CREATED


def test_order_decrements_stock(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    _make_order(client, token, variant.id, qty=3, amount=product.price * 3 + 350)
    db.refresh(variant)
    assert variant.stock_quantity == 7


def test_order_multi_brand_split(client, db):
    user = create_test_user(db)
    b1, p1, v1 = create_test_brand_with_product(db, stock=5, price=500)
    b2, p2, v2 = create_test_brand_with_product(db, stock=5, price=800)
    token = make_token(user)
    total = (500 + 350) + (800 + 350)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": total, "currency": "RUB"},
            "description": "multi-brand",
            "items": [
                {"product_variant_id": v1.id, "quantity": 1},
                {"product_variant_id": v2.id, "quantity": 1},
            ],
        },
    )
    assert resp.status_code == 200
    checkout_id = resp.json()["order_id"]
    orders = db.query(Order).filter(Order.checkout_id == checkout_id).all()
    assert len(orders) == 2


def test_order_calculates_free_shipping(client, db):
    """Brand with min_free_shipping=5000: subtotal >= 5000 -> shipping=0."""
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10, price=5000)
    token = make_token(user)
    resp = _make_order(client, token, variant.id, qty=1, amount=5000)
    assert resp.status_code == 200
    checkout_id = resp.json()["order_id"]
    order = db.query(Order).filter(Order.checkout_id == checkout_id).first()
    assert order.shipping_cost == 0.0


# ---------- Stock protection ----------


def test_insufficient_stock_rejects(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    resp = _make_order(client, token, variant.id, qty=11, amount=product.price * 11)
    assert resp.status_code == 400
    db.refresh(variant)
    assert variant.stock_quantity == 10  # unchanged


def test_exact_stock_succeeds(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=5)
    token = make_token(user)
    resp = _make_order(client, token, variant.id, qty=5, amount=product.price * 5 + 350)
    assert resp.status_code == 200
    db.refresh(variant)
    assert variant.stock_quantity == 0


def test_zero_stock_rejects(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=0)
    token = make_token(user)
    resp = _make_order(client, token, variant.id, qty=1, amount=product.price + 350)
    assert resp.status_code == 400


def test_multi_item_partial_failure_rolls_back(client, db):
    """If item2 is out of stock, item1 stock should NOT be decremented (single tx)."""
    user = create_test_user(db)
    b1, p1, v1 = create_test_brand_with_product(db, stock=10, price=500)
    b2, p2, v2 = create_test_brand_with_product(db, stock=0, price=800)
    token = make_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": 2000, "currency": "RUB"},
            "description": "partial fail",
            "items": [
                {"product_variant_id": v1.id, "quantity": 1},
                {"product_variant_id": v2.id, "quantity": 1},
            ],
        },
    )
    assert resp.status_code == 400
    db.refresh(v1)
    assert v1.stock_quantity == 10  # rolled back


# ---------- Cancel / return stock restoration ----------


def test_cancel_restores_stock(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    _make_order(client, token, variant.id, qty=3, amount=product.price * 3 + 350)
    db.expire_all()
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant.id).first()
    assert variant.stock_quantity == 7
    # Order is CREATED by default — buyer cancel works directly
    order = db.query(Order).first()
    resp = client.delete(
        f"/api/v1/orders/{order.id}/cancel",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    db.expire_all()
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant.id).first()
    assert variant.stock_quantity == 10


def test_double_cancel_no_double_restore(client, db):
    import payment_service

    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    _make_order(client, token, variant.id, qty=3, amount=product.price * 3 + 350)
    db.expire_all()
    order = db.query(Order).first()
    # First cancel
    payment_service.update_order_status(db, order.id, OrderStatus.CANCELED)
    db.commit()
    db.expire_all()
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant.id).first()
    assert variant.stock_quantity == 10
    # Second cancel — should be no-op (old_status == CANCELED already)
    payment_service.update_order_status(db, order.id, OrderStatus.CANCELED)
    db.commit()
    db.expire_all()
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant.id).first()
    assert variant.stock_quantity == 10  # still 10, not 13


def test_cancel_decrements_purchase_count(client, db):
    import payment_service

    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    _make_order(client, token, variant.id, qty=2, amount=product.price * 2 + 350)
    db.expire_all()
    order = db.query(Order).first()
    # CREATED -> PAID: increments purchase_count
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()
    db.expire_all()
    product = db.query(Product).filter(Product.id == product.id).first()
    assert product.purchase_count == 2
    # PAID -> CANCELED: decrements purchase_count
    payment_service.update_order_status(db, order.id, OrderStatus.CANCELED)
    db.commit()
    db.refresh(product)
    assert product.purchase_count == 0


# ---------- Webhook handling ----------


def _mock_webhook_ip():
    """Context manager to mock verify_webhook_ip -> True."""
    return patch("payment_service.verify_webhook_ip", return_value=True)


def test_webhook_payment_succeeded(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    with _mock_webhook_ip():
        resp = client.post(
            "/api/v1/payments/webhook",
            content=json.dumps(
                {
                    "event": "payment.succeeded",
                    "object": {"metadata": {"order_id": order.id}},
                }
            ),
        )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.status == OrderStatus.PAID
    db.refresh(product)
    assert product.purchase_count == 1


def test_webhook_payment_canceled(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    with _mock_webhook_ip():
        resp = client.post(
            "/api/v1/payments/webhook",
            content=json.dumps(
                {
                    "event": "payment.canceled",
                    "object": {"metadata": {"order_id": order.id}},
                }
            ),
        )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.status == OrderStatus.CANCELED
    db.refresh(variant)
    assert variant.stock_quantity == 10  # restored


def test_webhook_invalid_ip_rejected(client):
    with patch("payment_service.verify_webhook_ip", return_value=False):
        resp = client.post(
            "/api/v1/payments/webhook",
            content=json.dumps({"event": "payment.succeeded", "object": {}}),
        )
    assert resp.status_code == 400


def test_webhook_idempotent_double_paid(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    payload = json.dumps(
        {
            "event": "payment.succeeded",
            "object": {"metadata": {"order_id": order.id}},
        }
    )
    with _mock_webhook_ip():
        client.post("/api/v1/payments/webhook", content=payload)
        client.post("/api/v1/payments/webhook", content=payload)
    db.refresh(product)
    assert product.purchase_count == 1  # NOT 2


def test_expired_order_restores_stock(db):
    import payment_service

    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(
        db,
        user,
        brand,
        variant,
        qty=2,
        price=500,
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
    )
    assert variant.stock_quantity == 8

    count = payment_service.expire_pending_orders(db)
    assert count == 1
    db.refresh(variant)
    assert variant.stock_quantity == 10
    db.refresh(order)
    assert order.status == OrderStatus.CANCELED
