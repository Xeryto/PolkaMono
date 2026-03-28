"""Full order lifecycle, confirm-test, tracking, admin returns, list/detail."""

import uuid

import payment_service
from factories import (
    auth_header as _auth,
    create_order_in_db,
    create_test_brand_with_product,
    create_test_user,
    make_admin_token,
    make_brand_token,
    make_token,
)
from models import Order, OrderItem, OrderStatus, Product, ProductVariant


# ---------- confirm-test endpoint ----------


def test_confirm_test_order_success(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": product.price + 350, "currency": "RUB"},
            "description": "test",
            "items": [{"product_variant_id": variant.id, "quantity": 2}],
        },
    )
    checkout_id = resp.json()["order_id"]
    order = db.query(Order).filter(Order.checkout_id == checkout_id).first()
    assert order.status == OrderStatus.CREATED

    resp = client.post(
        f"/api/v1/orders/{order.id}/confirm-test",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.status == OrderStatus.PAID
    # purchase_count incremented
    db.refresh(product)
    assert product.purchase_count == 2


def test_confirm_test_already_paid_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()

    token = make_token(user)
    resp = client.post(
        f"/api/v1/orders/{order.id}/confirm-test",
        headers=_auth(token),
    )
    assert resp.status_code == 400


def test_confirm_test_other_users_order_rejected(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user_a, brand, variant, qty=1, price=1000)

    token_b = make_token(user_b)
    resp = client.post(
        f"/api/v1/orders/{order.id}/confirm-test",
        headers=_auth(token_b),
    )
    assert resp.status_code == 404


def test_confirm_test_brand_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    brand_token = make_brand_token(brand)
    resp = client.post(
        f"/api/v1/orders/{order.id}/confirm-test",
        headers=_auth(brand_token),
    )
    assert resp.status_code == 403


# ---------- Full lifecycle: CREATED -> PAID -> SHIPPED ----------


def test_full_lifecycle_created_paid_shipped(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    token = make_token(user)
    brand_token = make_brand_token(brand)

    # 1. Create order
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": product.price + 350, "currency": "RUB"},
            "description": "lifecycle",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    assert resp.status_code == 200
    checkout_id = resp.json()["order_id"]
    order = db.query(Order).filter(Order.checkout_id == checkout_id).first()
    assert order.status == OrderStatus.CREATED

    # 2. Confirm payment
    resp = client.post(
        f"/api/v1/orders/{order.id}/confirm-test",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.status == OrderStatus.PAID

    # 3. Brand sets tracking → SHIPPED
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={
            "tracking_number": "TRK123456",
            "tracking_link": "https://tracking.test/TRK123456",
        },
    )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.status == OrderStatus.SHIPPED
    assert order.tracking_number == "TRK123456"


# ---------- Brand tracking endpoint ----------


def test_tracking_partial_update_no_ship(client, db):
    """Setting only tracking_number (no link) should NOT transition to SHIPPED."""
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()

    brand_token = make_brand_token(brand)
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={"tracking_number": "TRK999"},
    )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.status == OrderStatus.PAID  # still PAID
    assert order.tracking_number == "TRK999"


def test_tracking_created_order_rejected(client, db):
    """Tracking on a CREATED order should be rejected (only PAID/SHIPPED allowed)."""
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    brand_token = make_brand_token(brand)
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={
            "tracking_number": "TRK111",
            "tracking_link": "https://tracking.test/111",
        },
    )
    assert resp.status_code == 400


def test_tracking_other_brands_order_rejected(client, db):
    user = create_test_user(db)
    brand_a, product_a, variant_a = create_test_brand_with_product(db, stock=10)
    brand_b, product_b, variant_b = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand_a, variant_a, qty=1, price=1000)

    token_b = make_brand_token(brand_b)
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(token_b),
        json={"tracking_number": "TRK-STOLEN"},
    )
    assert resp.status_code == 403


# ---------- Order list / detail ----------


def test_user_list_orders(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    create_order_in_db(db, user, brand, variant, qty=1, price=500)

    token = make_token(user)
    resp = client.get("/api/v1/orders", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_brand_list_orders(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    brand_token = make_brand_token(brand)
    resp = client.get("/api/v1/orders", headers=_auth(brand_token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_get_order_detail(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=2, price=1000)

    token = make_token(user)
    resp = client.get(f"/api/v1/orders/{order.id}", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(order.id)
    assert data["status"] == "created"
    assert len(data["items"]) == 1
    assert data["items"][0]["price"] > 0


# ---------- Order status history ----------


def test_order_status_history(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()

    token = make_token(user)
    resp = client.get(
        f"/api/v1/orders/{order.id}/history",
        headers=_auth(token),
    )
    assert resp.status_code == 200
    events = resp.json()
    assert len(events) >= 1
    assert events[-1]["to_status"] == "paid"


# ---------- Admin return endpoint — per-item stock restoration ----------


def _ship_order(db, order):
    """Move order CREATED → PAID → SHIPPED."""
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    payment_service.update_order_status(db, order.id, OrderStatus.SHIPPED)
    db.commit()


def test_admin_return_single_item_restores_stock(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=2, price=1000)
    assert variant.stock_quantity == 8
    _ship_order(db, order)

    item = db.query(OrderItem).filter(OrderItem.order_id == order.id).first()
    admin_token = make_admin_token(db)
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item.id)]},
    )
    assert resp.status_code == 204
    db.expire_all()
    variant = db.query(ProductVariant).filter(ProductVariant.id == variant.id).first()
    assert variant.stock_quantity == 10
    product = db.query(Product).filter(Product.id == product.id).first()
    assert product.purchase_count == 0
    order = db.query(Order).filter(Order.id == order.id).first()
    assert order.status == OrderStatus.RETURNED


def test_admin_partial_return_restores_stock(client, db):
    user = create_test_user(db)
    brand, product, variant1 = create_test_brand_with_product(db, stock=10)
    # Create a second variant under the same product
    from models import ProductColorVariant

    cv = db.query(ProductColorVariant).filter(
        ProductColorVariant.product_id == product.id
    ).first()
    variant2 = ProductVariant(
        id=str(uuid.uuid4()),
        product_color_variant_id=cv.id,
        size="L",
        stock_quantity=10,
    )
    db.add(variant2)
    db.commit()

    order = create_order_in_db(db, user, brand, variant1, qty=1, price=1000)
    # Add second item to the same order
    oi2 = OrderItem(
        order_id=order.id,
        product_variant_id=variant2.id,
        quantity=2,
        price=1000.0,
    )
    db.add(oi2)
    variant2.stock_quantity -= 2
    db.commit()

    _ship_order(db, order)

    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    item1 = [i for i in items if i.product_variant_id == variant1.id][0]

    admin_token = make_admin_token(db)
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item1.id)]},
    )
    assert resp.status_code == 204
    db.expire_all()
    v1 = db.query(ProductVariant).filter(ProductVariant.id == variant1.id).first()
    v2 = db.query(ProductVariant).filter(ProductVariant.id == variant2.id).first()
    assert v1.stock_quantity == 10  # restored
    assert v2.stock_quantity == 8   # unchanged
    order = db.query(Order).filter(Order.id == order.id).first()
    assert order.status == OrderStatus.PARTIALLY_RETURNED


def test_admin_partial_then_full_return(client, db):
    user = create_test_user(db)
    brand, product, variant1 = create_test_brand_with_product(db, stock=10)
    from models import ProductColorVariant

    cv = db.query(ProductColorVariant).filter(
        ProductColorVariant.product_id == product.id
    ).first()
    variant2 = ProductVariant(
        id=str(uuid.uuid4()),
        product_color_variant_id=cv.id,
        size="L",
        stock_quantity=10,
    )
    db.add(variant2)
    db.commit()

    order = create_order_in_db(db, user, brand, variant1, qty=1, price=1000)
    oi2 = OrderItem(
        order_id=order.id,
        product_variant_id=variant2.id,
        quantity=1,
        price=1000.0,
    )
    db.add(oi2)
    variant2.stock_quantity -= 1
    db.commit()

    _ship_order(db, order)

    items = db.query(OrderItem).filter(OrderItem.order_id == order.id).all()
    item1 = [i for i in items if i.product_variant_id == variant1.id][0]
    item2 = [i for i in items if i.product_variant_id == variant2.id][0]

    admin_token = make_admin_token(db)
    # Return item 1
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item1.id)]},
    )
    assert resp.status_code == 204
    db.expire_all()
    assert db.get(ProductVariant, variant1.id).stock_quantity == 10
    assert db.get(ProductVariant, variant2.id).stock_quantity == 9
    assert db.get(Order, order.id).status == OrderStatus.PARTIALLY_RETURNED

    # Return item 2
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item2.id)]},
    )
    assert resp.status_code == 204
    db.expire_all()
    assert db.get(ProductVariant, variant1.id).stock_quantity == 10  # no double
    assert db.get(ProductVariant, variant2.id).stock_quantity == 10
    assert db.get(Order, order.id).status == OrderStatus.RETURNED


def test_admin_return_already_returned_item_skipped(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=2, price=1000)
    _ship_order(db, order)

    item = db.query(OrderItem).filter(OrderItem.order_id == order.id).first()
    admin_token = make_admin_token(db)

    # First return
    client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item.id)]},
    )
    db.expire_all()
    assert db.get(ProductVariant, variant.id).stock_quantity == 10

    # Second return of same item — order is now RETURNED, so request is rejected
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item.id)]},
    )
    assert resp.status_code == 400  # order no longer SHIPPED/PARTIALLY_RETURNED
    db.expire_all()
    assert db.get(ProductVariant, variant.id).stock_quantity == 10  # no double


def test_admin_return_nonexistent_item_404(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    _ship_order(db, order)

    admin_token = make_admin_token(db)
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(uuid.uuid4())]},
    )
    assert resp.status_code == 404


# ---------- Tracking status guards ----------


def test_tracking_canceled_order_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.CANCELED)
    db.commit()

    brand_token = make_brand_token(brand)
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={"tracking_number": "TRK-CANCEL"},
    )
    assert resp.status_code == 400


def test_tracking_returned_order_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    _ship_order(db, order)
    # Return all items
    item = db.query(OrderItem).filter(OrderItem.order_id == order.id).first()
    item.status = "returned"
    payment_service.update_order_status(db, order.id, OrderStatus.RETURNED)
    db.commit()

    brand_token = make_brand_token(brand)
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={"tracking_link": "https://tracking.test/returned"},
    )
    assert resp.status_code == 400


def test_tracking_shipped_order_update_allowed(client, db):
    """SHIPPED order can still update tracking (e.g. correcting a link)."""
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()

    brand_token = make_brand_token(brand)
    # Set tracking → SHIPPED
    client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={
            "tracking_number": "TRK-SHIP",
            "tracking_link": "https://tracking.test/ship",
        },
    )
    db.refresh(order)
    assert order.status == OrderStatus.SHIPPED

    # Update link on already-shipped order
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(brand_token),
        json={"tracking_link": "https://tracking.test/ship-v2"},
    )
    assert resp.status_code == 200
    db.refresh(order)
    assert order.tracking_link == "https://tracking.test/ship-v2"
    assert order.status == OrderStatus.SHIPPED


# ---------- Admin return status guards ----------


def test_admin_return_created_order_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)

    item = db.query(OrderItem).filter(OrderItem.order_id == order.id).first()
    admin_token = make_admin_token(db)
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item.id)]},
    )
    assert resp.status_code == 400


def test_admin_return_canceled_order_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.CANCELED)
    db.commit()

    item = db.query(OrderItem).filter(OrderItem.order_id == order.id).first()
    admin_token = make_admin_token(db)
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item.id)]},
    )
    assert resp.status_code == 400


def test_admin_return_paid_not_shipped_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    order = create_order_in_db(db, user, brand, variant, qty=1, price=1000)
    payment_service.update_order_status(db, order.id, OrderStatus.PAID)
    db.commit()

    item = db.query(OrderItem).filter(OrderItem.order_id == order.id).first()
    admin_token = make_admin_token(db)
    resp = client.post(
        "/api/v1/admin/returns/log",
        headers=_auth(admin_token),
        json={"order_id": str(order.id), "item_ids": [str(item.id)]},
    )
    assert resp.status_code == 400


# ---------- Inactive brand order rejection ----------


def test_order_inactive_brand_rejected(client, db):
    user = create_test_user(db)
    brand, product, variant = create_test_brand_with_product(db, stock=10)
    brand.is_inactive = True
    db.commit()

    token = make_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": product.price + 350, "currency": "RUB"},
            "description": "test",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    assert resp.status_code == 400


def test_order_mixed_brands_inactive_rejected(client, db):
    user = create_test_user(db)
    brand_a, product_a, variant_a = create_test_brand_with_product(db, stock=10)
    brand_b, product_b, variant_b = create_test_brand_with_product(db, stock=10)
    brand_b.is_inactive = True
    db.commit()

    token = make_token(user)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": product_a.price + product_b.price + 700, "currency": "RUB"},
            "description": "test",
            "items": [
                {"product_variant_id": variant_a.id, "quantity": 1},
                {"product_variant_id": variant_b.id, "quantity": 1},
            ],
        },
    )
    assert resp.status_code == 400
