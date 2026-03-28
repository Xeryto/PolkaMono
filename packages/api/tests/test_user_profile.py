"""Tests for user profile, shipping, preferences, completion status."""

from factories import (
    auth_header as _auth,
    create_test_user,
    make_token,
)


# ---------- get profile ----------


def test_get_profile_200(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/user/profile", headers=_auth(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == user.id
    assert data["username"] == user.username


def test_get_profile_unauthenticated(client):
    resp = client.get("/api/v1/user/profile")
    assert resp.status_code in (401, 403)


# ---------- update core profile (username/email) ----------


def test_update_username(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.put(
        "/api/v1/user/profile",
        headers=_auth(token),
        json={"username": "newname123"},
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "newname123"


def test_update_username_profanity_rejected(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.put(
        "/api/v1/user/profile",
        headers=_auth(token),
        json={"username": "fuck123"},
    )
    assert resp.status_code == 422


# ---------- update profile data ----------


def test_update_profile_data(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.put(
        "/api/v1/user/profile/data",
        headers=_auth(token),
        json={"full_name": "John Doe", "gender": "male"},
    )
    assert resp.status_code == 200
    assert resp.json()["full_name"] == "John Doe"
    assert resp.json()["gender"] == "male"


# ---------- shipping ----------


def test_update_shipping(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.put(
        "/api/v1/user/shipping",
        headers=_auth(token),
        json={"city": "Санкт-Петербург", "postal_code": "190000"},
    )
    assert resp.status_code == 200
    assert resp.json()["city"] == "Санкт-Петербург"


# ---------- preferences ----------


def test_update_preferences(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.put(
        "/api/v1/user/preferences",
        headers=_auth(token),
        json={"likes_privacy": "everyone", "order_notifications": False},
    )
    assert resp.status_code == 200


# ---------- completion status ----------


def test_completion_status_incomplete(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get(
        "/api/v1/user/profile/completion-status", headers=_auth(token)
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["isComplete"] is False
    assert "gender" in data["missingFields"]
