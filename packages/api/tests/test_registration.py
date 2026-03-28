"""Registration flow tests (7 tests)."""

import uuid


def test_register_success(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": "newuser1",
            "email": "new@test.com",
            "password": "Str0ngPass1",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "new@test.com"
    assert data["user"]["is_email_verified"] is False


def test_register_duplicate_email(client):
    payload = {
        "username": "user_a",
        "email": "dup@test.com",
        "password": "Str0ngPass1",
    }
    client.post("/api/v1/auth/register", json=payload)
    resp = client.post(
        "/api/v1/auth/register",
        json={**payload, "username": "user_b"},
    )
    assert resp.status_code == 400


def test_register_duplicate_username(client):
    base = {"password": "Str0ngPass1"}
    client.post(
        "/api/v1/auth/register",
        json={**base, "username": "taken", "email": f"a-{uuid.uuid4().hex[:6]}@t.com"},
    )
    resp = client.post(
        "/api/v1/auth/register",
        json={**base, "username": "taken", "email": f"b-{uuid.uuid4().hex[:6]}@t.com"},
    )
    assert resp.status_code == 400


def test_register_password_too_short(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "short", "email": "s@t.com", "password": "Ab1"},
    )
    assert resp.status_code == 422


def test_register_password_no_digits(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "nodig", "email": "n@t.com", "password": "abcdefgh"},
    )
    assert resp.status_code == 422


def test_register_common_password(client):
    resp = client.post(
        "/api/v1/auth/register",
        json={"username": "common", "email": "c@t.com", "password": "password1"},
    )
    assert resp.status_code == 422


def test_register_sends_verification_email(client, mock_mail):
    client.post(
        "/api/v1/auth/register",
        json={
            "username": "verifyuser",
            "email": "verify@test.com",
            "password": "Str0ngPass1",
        },
    )
    mock_mail.assert_called()
    assert mock_mail.call_args.kwargs["to_email"] == "verify@test.com"
