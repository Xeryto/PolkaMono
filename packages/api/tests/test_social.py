"""Tests for social features: favorites, swipes, friends."""

from factories import (
    auth_header as _auth,
    create_friend_pair,
    create_test_brand_with_product,
    create_test_user,
    create_user_like,
    make_token,
)
from models import FriendRequest, Friendship


# ---------- favorites ----------


def test_toggle_like_on(client, db):
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/favorites/toggle",
        headers=_auth(token),
        json={"product_id": product.id, "action": "like"},
    )
    assert resp.status_code == 200
    assert "liked" in resp.json()["message"].lower()


def test_toggle_like_off(client, db):
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    create_user_like(db, user, product)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/favorites/toggle",
        headers=_auth(token),
        json={"product_id": product.id, "action": "unlike"},
    )
    assert resp.status_code == 200


def test_get_favorites_list(client, db):
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    create_user_like(db, user, product)
    token = make_token(user)
    resp = client.get("/api/v1/user/favorites", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == product.id


def test_get_favorites_empty(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/user/favorites", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json() == []


# ---------- swipes ----------


def test_track_swipe(client, db):
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/swipe",
        headers=_auth(token),
        json={"product_id": product.id},
    )
    assert resp.status_code == 200


def test_recent_swipes(client, db):
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    token = make_token(user)
    # Track a swipe first
    client.post(
        "/api/v1/user/swipe",
        headers=_auth(token),
        json={"product_id": product.id},
    )
    resp = client.get("/api/v1/user/recent-swipes?limit=5", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


# ---------- friends ----------


def test_send_friend_request(client, db):
    user1 = create_test_user(db)
    user2 = create_test_user(db)
    token = make_token(user1)
    resp = client.post(
        "/api/v1/friends/request",
        headers=_auth(token),
        json={"recipient_identifier": user2.username},
    )
    assert resp.status_code == 200
    assert "sent" in resp.json()["message"].lower()


def test_send_friend_request_duplicate_rejected(client, db):
    user1 = create_test_user(db)
    user2 = create_test_user(db)
    token = make_token(user1)
    client.post(
        "/api/v1/friends/request",
        headers=_auth(token),
        json={"recipient_identifier": user2.username},
    )
    resp = client.post(
        "/api/v1/friends/request",
        headers=_auth(token),
        json={"recipient_identifier": user2.username},
    )
    assert resp.status_code == 400


def test_accept_friend_request(client, db):
    user1 = create_test_user(db)
    user2 = create_test_user(db)
    # Send request
    token1 = make_token(user1)
    client.post(
        "/api/v1/friends/request",
        headers=_auth(token1),
        json={"recipient_identifier": user2.username},
    )
    # Find the request
    fr = db.query(FriendRequest).filter(
        FriendRequest.sender_id == user1.id,
        FriendRequest.recipient_id == user2.id,
    ).first()
    assert fr is not None

    # Accept
    token2 = make_token(user2)
    resp = client.post(
        f"/api/v1/friends/requests/{fr.id}/accept",
        headers=_auth(token2),
    )
    assert resp.status_code == 200

    # Verify friendship exists
    friendship = db.query(Friendship).filter(
        Friendship.user_id == user1.id,
        Friendship.friend_id == user2.id,
    ).first()
    assert friendship is not None


def test_list_friends(client, db):
    user1 = create_test_user(db)
    user2 = create_test_user(db)
    create_friend_pair(db, user1, user2)
    token = make_token(user1)
    resp = client.get("/api/v1/friends", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_unfriend(client, db):
    user1 = create_test_user(db)
    user2 = create_test_user(db)
    create_friend_pair(db, user1, user2)
    token = make_token(user1)
    resp = client.delete(f"/api/v1/friends/{user2.id}", headers=_auth(token))
    assert resp.status_code == 200

    # Verify friendship gone
    f = db.query(Friendship).filter(
        Friendship.user_id == user1.id,
        Friendship.friend_id == user2.id,
    ).first()
    assert f is None


def test_send_friend_request_to_self_rejected(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/friends/request",
        headers=_auth(token),
        json={"recipient_identifier": user.username},
    )
    assert resp.status_code == 400


def test_send_friend_request_nonexistent_user(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/friends/request",
        headers=_auth(token),
        json={"recipient_identifier": "ghost_user_999"},
    )
    assert resp.status_code == 400
