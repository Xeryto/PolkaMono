"""Security tests: malicious input, auth bypass, IDOR (10 tests)."""

import uuid
from datetime import datetime, timedelta, timezone

import jwt as pyjwt

from factories import (
    auth_header as _auth,
    create_test_brand_with_product,
    create_test_user,
    make_token as _get_token,
)


# ---------- Negative/zero quantity ----------


def test_negative_quantity_rejected(client, db):
    """CartItem.quantity < 1 should be rejected by validator."""
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = _get_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": 1000, "currency": "RUB"},
            "description": "neg qty",
            "items": [{"product_variant_id": variant.id, "quantity": -5}],
        },
    )
    assert resp.status_code == 422
    db.refresh(variant)
    assert variant.stock_quantity == 10  # unchanged


def test_zero_quantity_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = _get_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": 1000, "currency": "RUB"},
            "description": "zero qty",
            "items": [{"product_variant_id": variant.id, "quantity": 0}],
        },
    )
    assert resp.status_code == 422


def test_negative_amount_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db)
    token = _get_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": -100, "currency": "RUB"},
            "description": "neg amount",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    assert resp.status_code == 422


# ---------- Auth bypass ----------


def test_expired_token_rejected(client):
    from config import settings

    expired_token = pyjwt.encode(
        {"sub": "fake-user-id", "exp": datetime.now(timezone.utc) - timedelta(hours=1)},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    resp = client.get("/api/v1/orders", headers=_auth(expired_token))
    assert resp.status_code == 401


def test_no_token_rejected(client):
    resp = client.get("/api/v1/orders")
    assert resp.status_code == 403


def test_tampered_token_rejected(client):
    from config import settings

    # Create valid token then tamper with payload
    valid = pyjwt.encode(
        {"sub": "user-123", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    # Tamper: sign with different key
    tampered = pyjwt.encode(
        {"sub": "admin-hacker", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "wrong-secret-key",
        algorithm="HS256",
    )
    resp = client.get("/api/v1/orders", headers=_auth(tampered))
    assert resp.status_code == 401


def test_brand_cannot_create_order(client, db):
    brand, product, variant = create_test_brand_with_product(db)
    from auth_service import auth_service

    brand_token = auth_service.create_access_token(
        data={"sub": str(brand.id), "is_brand": True}
    )
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(brand_token),
        json={
            "amount": {"value": 1000, "currency": "RUB"},
            "description": "brand order",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    assert resp.status_code == 403


# ---------- IDOR ----------


def test_cancel_other_users_order(client, db):
    from models import Checkout, Order, OrderItem, OrderStatus

    user_a = create_test_user(db)
    user_b = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    # Create order for user_a
    token_a = _get_token(user_a)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token_a),
        json={
            "amount": {"value": 1350, "currency": "RUB"},
            "description": "a's order",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    checkout_id = resp.json()["order_id"]
    order = db.query(Order).filter(Order.checkout_id == checkout_id).first()
    # Order is CREATED by default — cancel is allowed status-wise
    # User B tries to cancel
    token_b = _get_token(user_b)
    resp = client.delete(
        f"/api/v1/orders/{order.id}/cancel",
        headers=_auth(token_b),
    )
    assert resp.status_code == 404


def test_view_other_users_order(client, db):
    from models import Order

    user_a = create_test_user(db)
    user_b = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token_a = _get_token(user_a)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token_a),
        json={
            "amount": {"value": 1350, "currency": "RUB"},
            "description": "a's order",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    checkout_id = resp.json()["order_id"]
    order = db.query(Order).filter(Order.checkout_id == checkout_id).first()
    token_b = _get_token(user_b)
    resp = client.get(f"/api/v1/orders/{order.id}", headers=_auth(token_b))
    assert resp.status_code == 404


# ---------- Input bounds ----------


def test_extremely_large_quantity(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=5)
    token = _get_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": 999999999, "currency": "RUB"},
            "description": "huge qty",
            "items": [{"product_variant_id": variant.id, "quantity": 999999999}],
        },
    )
    assert resp.status_code == 400
