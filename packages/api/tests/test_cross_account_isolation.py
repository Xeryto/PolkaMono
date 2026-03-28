"""Cross-account isolation tests: verify principal A cannot access principal B's data."""

import uuid

from factories import (
    auth_header as _auth,
    create_friend_pair,
    create_order_in_db,
    create_test_brand_with_product,
    create_test_style,
    create_test_user,
    create_user_like,
    make_brand_token,
    make_token,
)
from models import (
    FriendRequest,
    FriendRequestStatus,
    OrderStatus,
    UserPreferences,
    PrivacyOption,
)


# ── Brand ↔ Brand isolation ──────────────────────────────────────────


def test_brand_b_cannot_view_brand_a_product(client, db):
    _, product_a, _ = create_test_brand_with_product(db)
    brand_b, _, _ = create_test_brand_with_product(db)
    token_b = make_brand_token(brand_b)
    resp = client.get(
        f"/api/v1/brands/products/{product_a.id}", headers=_auth(token_b)
    )
    assert resp.status_code == 403


def test_brand_b_cannot_update_brand_a_product(client, db):
    _, product_a, _ = create_test_brand_with_product(db)
    brand_b, _, _ = create_test_brand_with_product(db)
    token_b = make_brand_token(brand_b)
    resp = client.put(
        f"/api/v1/brands/products/{product_a.id}",
        headers=_auth(token_b),
        json={"name": "Hijacked"},
    )
    assert resp.status_code == 403


def test_brand_b_cannot_update_brand_a_order_tracking(client, db):
    user = create_test_user(db)
    brand_a, _, variant_a = create_test_brand_with_product(db, stock=5)
    brand_b, _, _ = create_test_brand_with_product(db)
    order = create_order_in_db(db, user, brand_a, variant_a, status=OrderStatus.PAID)
    token_b = make_brand_token(brand_b)
    resp = client.put(
        f"/api/v1/brands/orders/{order.id}/tracking",
        headers=_auth(token_b),
        json={"tracking_number": "HIJACK123"},
    )
    assert resp.status_code == 403


def test_brand_orders_list_only_own(client, db):
    """GET /api/v1/orders as brand returns only that brand's orders."""
    user = create_test_user(db)
    brand_a, _, variant_a = create_test_brand_with_product(db, stock=5)
    brand_b, _, variant_b = create_test_brand_with_product(db, stock=5)
    create_order_in_db(db, user, brand_a, variant_a, status=OrderStatus.PAID)
    create_order_in_db(db, user, brand_b, variant_b, status=OrderStatus.PAID)
    token_a = make_brand_token(brand_a)
    resp = client.get("/api/v1/orders", headers=_auth(token_a))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── User ↔ User isolation ────────────────────────────────────────────


def test_user_b_cannot_cancel_user_a_order(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    brand, _, variant = create_test_brand_with_product(db, stock=5)
    order = create_order_in_db(db, user_a, brand, variant, status=OrderStatus.CREATED)
    token_b = make_token(user_b)
    resp = client.delete(
        f"/api/v1/orders/{order.id}/cancel", headers=_auth(token_b)
    )
    assert resp.status_code == 404


def test_user_b_cannot_view_user_a_order(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    brand, _, variant = create_test_brand_with_product(db, stock=5)
    order = create_order_in_db(db, user_a, brand, variant, status=OrderStatus.PAID)
    token_b = make_token(user_b)
    resp = client.get(f"/api/v1/orders/{order.id}", headers=_auth(token_b))
    assert resp.status_code == 404


def test_user_orders_list_only_own(client, db):
    """GET /api/v1/orders as user returns only that user's orders."""
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    brand, _, variant = create_test_brand_with_product(db, stock=10)
    create_order_in_db(db, user_a, brand, variant, qty=1, status=OrderStatus.PAID)
    create_order_in_db(db, user_b, brand, variant, qty=1, status=OrderStatus.PAID)
    token_a = make_token(user_a)
    resp = client.get("/api/v1/orders", headers=_auth(token_a))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


# ── Privacy: likes ────────────────────────────────────────────────────


def _set_privacy(db, user, field, value):
    prefs = db.query(UserPreferences).filter(UserPreferences.user_id == user.id).first()
    if not prefs:
        prefs = UserPreferences(id=str(uuid.uuid4()), user_id=user.id)
        db.add(prefs)
    setattr(prefs, field, value)
    db.commit()


def test_likes_privacy_nobody_blocks_non_friend(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    create_user_like(db, user_a, product)
    _set_privacy(db, user_a, "likes_privacy", PrivacyOption.NOBODY)
    token_b = make_token(user_b)
    resp = client.get(f"/api/v1/users/{user_a.id}/likes", headers=_auth(token_b))
    assert resp.status_code == 403


def test_likes_privacy_friends_blocks_stranger(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    create_user_like(db, user_a, product)
    _set_privacy(db, user_a, "likes_privacy", PrivacyOption.FRIENDS)
    token_b = make_token(user_b)
    resp = client.get(f"/api/v1/users/{user_a.id}/likes", headers=_auth(token_b))
    assert resp.status_code == 403


def test_likes_privacy_friends_allows_friend(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    create_friend_pair(db, user_a, user_b)
    _, product, _ = create_test_brand_with_product(db)
    create_user_like(db, user_a, product)
    _set_privacy(db, user_a, "likes_privacy", PrivacyOption.FRIENDS)
    token_b = make_token(user_b)
    resp = client.get(f"/api/v1/users/{user_a.id}/likes", headers=_auth(token_b))
    assert resp.status_code == 200
    assert len(resp.json()) == 1


def test_likes_privacy_everyone_allows_stranger(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    create_user_like(db, user_a, product)
    _set_privacy(db, user_a, "likes_privacy", PrivacyOption.EVERYONE)
    token_b = make_token(user_b)
    resp = client.get(f"/api/v1/users/{user_a.id}/likes", headers=_auth(token_b))
    assert resp.status_code == 200


# ── Privacy: public profile ───────────────────────────────────────────


def test_public_profile_respects_privacy(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    _set_privacy(db, user_a, "likes_privacy", PrivacyOption.NOBODY)
    _set_privacy(db, user_a, "recommendations_privacy", PrivacyOption.NOBODY)
    token_b = make_token(user_b)
    resp = client.get(
        f"/api/v1/users/{user_a.id}/profile", headers=_auth(token_b)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["can_view_likes"] is False
    assert data["can_view_recommendations"] is False


# ── User ↔ Brand role boundary (user→brand) ──────────────────────────


def test_user_cannot_access_brand_products_endpoint(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/brands/products", headers=_auth(token))
    assert resp.status_code == 403


def test_user_cannot_access_brand_stats(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/brands/stats", headers=_auth(token))
    assert resp.status_code == 403


# ── Brand ↔ User role boundary (brand→user) ──────────────────────────


def test_brand_cannot_create_test_order(client, db):
    brand, _, variant = create_test_brand_with_product(db, stock=5)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/orders/test",
        headers=_auth(token),
        json={
            "amount": {"value": 1000, "currency": "RUB"},
            "description": "brand placing order",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    assert resp.status_code == 403


def test_brand_cannot_create_payment(client, db):
    brand, _, variant = create_test_brand_with_product(db, stock=5)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/payments/create",
        headers=_auth(token),
        json={
            "amount": {"value": 1000, "currency": "RUB"},
            "description": "brand payment",
            "returnUrl": "https://example.com/return",
            "items": [{"product_variant_id": variant.id, "quantity": 1}],
        },
    )
    assert resp.status_code == 403


def test_brand_cannot_toggle_favorites(client, db):
    brand, product, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/user/favorites/toggle",
        headers=_auth(token),
        json={"product_id": product.id, "action": "like"},
    )
    assert resp.status_code == 403


def test_brand_cannot_get_favorites(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/user/favorites", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_user_profile(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/user/profile", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_update_user_profile(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.put(
        "/api/v1/user/profile",
        headers=_auth(token),
        json={"username": "hijacked"},
    )
    assert resp.status_code == 403


def test_brand_cannot_update_user_profile_data(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.put(
        "/api/v1/user/profile/data",
        headers=_auth(token),
        json={"full_name": "Hijacked"},
    )
    assert resp.status_code == 403


def test_brand_cannot_get_completion_status(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/user/profile/completion-status", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_oauth_accounts(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/user/oauth-accounts", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_update_shipping(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.put(
        "/api/v1/user/shipping",
        headers=_auth(token),
        json={"city": "Москва"},
    )
    assert resp.status_code == 403


def test_brand_cannot_update_preferences(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.put(
        "/api/v1/user/preferences",
        headers=_auth(token),
        json={"order_notifications": False},
    )
    assert resp.status_code == 403


def test_brand_cannot_save_user_brands(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/user/brands",
        headers=_auth(token),
        json={"brand_ids": [brand.id]},
    )
    assert resp.status_code == 403


def test_brand_cannot_save_user_styles(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    style = create_test_style(db)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/user/styles",
        headers=_auth(token),
        json={"style_ids": [style.id]},
    )
    assert resp.status_code == 403


def test_brand_cannot_track_swipe(client, db):
    brand, product, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/user/swipe",
        headers=_auth(token),
        json={"product_id": product.id},
    )
    assert resp.status_code == 403


def test_brand_cannot_get_recent_swipes(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/user/recent-swipes", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_user_stats(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/user/stats", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_recommendations(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/recommendations/for_user", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_friend_recommendations(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_brand_token(brand)
    resp = client.get(
        f"/api/v1/recommendations/for_friend/{user.id}", headers=_auth(token)
    )
    assert resp.status_code == 403


def test_brand_cannot_get_popular_products(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/products/popular", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_search_products(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/products/search?query=test", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_product_detail(client, db):
    brand, product, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get(f"/api/v1/products/{product.id}", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_friend_likes(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_brand_token(brand)
    resp = client.get(f"/api/v1/users/{user.id}/likes", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_public_user_profile(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_brand_token(brand)
    resp = client.get(f"/api/v1/users/{user.id}/profile", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_request_verification(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.post("/api/v1/auth/request-verification", headers=_auth(token))
    assert resp.status_code == 403


# ── Brand cannot use social/friends ──────────────────────────────────


def test_brand_cannot_send_friend_request(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_brand_token(brand)
    resp = client.post(
        "/api/v1/friends/request",
        headers=_auth(token),
        json={"recipient_identifier": user.username},
    )
    assert resp.status_code == 403


def test_brand_cannot_get_sent_friend_requests(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/friends/requests/sent", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_get_received_friend_requests(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/friends/requests/received", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_accept_friend_request(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.post(
        f"/api/v1/friends/requests/{uuid.uuid4()}/accept", headers=_auth(token)
    )
    assert resp.status_code == 403


def test_brand_cannot_reject_friend_request(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.post(
        f"/api/v1/friends/requests/{uuid.uuid4()}/reject", headers=_auth(token)
    )
    assert resp.status_code == 403


def test_brand_cannot_cancel_friend_request(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.delete(
        f"/api/v1/friends/requests/{uuid.uuid4()}/cancel", headers=_auth(token)
    )
    assert resp.status_code == 403


def test_brand_cannot_get_friends_list(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/friends", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_unfriend(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.delete(
        f"/api/v1/friends/{uuid.uuid4()}", headers=_auth(token)
    )
    assert resp.status_code == 403


def test_brand_cannot_search_users(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/users/search?query=test", headers=_auth(token))
    assert resp.status_code == 403


# ── Friend request isolation (user↔user) ─────────────────────────────


def test_user_c_cannot_accept_request_sent_to_user_b(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    user_c = create_test_user(db)
    fr = FriendRequest(
        id=str(uuid.uuid4()),
        sender_id=user_a.id,
        recipient_id=user_b.id,
        status=FriendRequestStatus.PENDING,
    )
    db.add(fr)
    db.commit()
    token_c = make_token(user_c)
    resp = client.post(
        f"/api/v1/friends/requests/{fr.id}/accept", headers=_auth(token_c)
    )
    assert resp.status_code == 404


def test_user_c_cannot_reject_request_sent_to_user_b(client, db):
    user_a = create_test_user(db)
    user_b = create_test_user(db)
    user_c = create_test_user(db)
    fr = FriendRequest(
        id=str(uuid.uuid4()),
        sender_id=user_a.id,
        recipient_id=user_b.id,
        status=FriendRequestStatus.PENDING,
    )
    db.add(fr)
    db.commit()
    token_c = make_token(user_c)
    resp = client.post(
        f"/api/v1/friends/requests/{fr.id}/reject", headers=_auth(token_c)
    )
    assert resp.status_code == 404
