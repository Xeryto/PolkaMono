"""Login, lockout, token refresh, email verification tests (14 tests)."""

import uuid
from datetime import datetime, timedelta, timezone

from factories import register_and_login


# ---------- Login basics ----------


def test_login_by_email(client):
    email = f"login-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "token" in data
    assert "refresh_token" in data


def test_login_by_username(client):
    uname = f"loginuser_{uuid.uuid4().hex[:6]}"
    register_and_login(client, username=uname)
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": uname, "password": "TestPass1"},
    )
    assert resp.status_code == 200


def test_login_wrong_password(client):
    email = f"wp-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "WrongPass1"},
    )
    assert resp.status_code == 401


def test_login_nonexistent_user(client):
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": "nobody@test.com", "password": "NoPass123"},
    )
    assert resp.status_code == 401


def test_login_unverified_resends_code(client, mock_mail):
    email = f"unverified-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    mock_mail.reset_mock()
    client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    # Should have sent a verification email (user is not verified)
    mock_mail.assert_called()
    assert mock_mail.call_args.kwargs["to_email"] == email


# ---------- Lockout ----------


def test_lockout_after_max_attempts(client, db):
    email = f"lockout-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    # Fail 5 times (LOGIN_MAX_FAILED_ATTEMPTS default=5)
    for _ in range(5):
        client.post(
            "/api/v1/auth/login",
            json={"identifier": email, "password": "Wrong1234"},
        )
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    assert resp.status_code == 423


def test_lockout_expires(client, db):
    from models import AuthAccount

    email = f"lockexp-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    # Set lockout to past
    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    acc.login_locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)
    acc.failed_login_attempts = 5
    db.commit()
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    assert resp.status_code == 200


def test_failed_attempts_reset_on_success(client):
    email = f"reset-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    # 2 wrong
    for _ in range(2):
        client.post(
            "/api/v1/auth/login",
            json={"identifier": email, "password": "Wrong1234"},
        )
    # 1 correct → resets counter
    client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    # 2 more wrong — should NOT lock (counter was reset)
    for _ in range(2):
        client.post(
            "/api/v1/auth/login",
            json={"identifier": email, "password": "Wrong1234"},
        )
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    assert resp.status_code == 200  # not locked


# ---------- Token refresh ----------


def test_refresh_success(client):
    _, _, refresh = register_and_login(client)
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 200
    assert "token" in resp.json()


def test_refresh_rotates_token(client):
    _, _, old_refresh = register_and_login(client)
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200
    # Old token should be invalid now
    resp2 = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert resp2.status_code == 401


def test_refresh_garbage_token(client):
    resp = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": "garbage-token-abc123"}
    )
    assert resp.status_code == 401


def test_refresh_expired_token(client, db):
    from models import AuthAccount

    email = f"refexp-{uuid.uuid4().hex[:6]}@test.com"
    _, _, refresh = register_and_login(client, email=email)
    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    acc.refresh_token_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()
    resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 401


# ---------- Email verification ----------


def test_verify_email_success(client, db):
    from models import AuthAccount

    email = f"vfy-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    code = acc.email_verification_code
    assert code is not None
    resp = client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "code": code},
    )
    assert resp.status_code == 200
    db.refresh(acc)
    assert acc.is_email_verified is True


def test_verify_email_wrong_code(client):
    email = f"vfyw-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    resp = client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "code": "000000"},
    )
    assert resp.status_code == 400


def test_verify_email_expired_code(client, db):
    from models import AuthAccount

    email = f"vfyexp-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    code = acc.email_verification_code
    acc.email_verification_code_expires_at = datetime.now(timezone.utc) - timedelta(
        minutes=1
    )
    db.commit()
    resp = client.post(
        "/api/v1/auth/verify-email",
        json={"email": email, "code": code},
    )
    assert resp.status_code == 400


def test_login_after_verification(client, db):
    from models import AuthAccount

    email = f"vfylogin-{uuid.uuid4().hex[:6]}@test.com"
    register_and_login(client, email=email)
    acc = db.query(AuthAccount).filter(AuthAccount.email == email).first()
    code = acc.email_verification_code
    client.post("/api/v1/auth/verify-email", json={"email": email, "code": code})
    resp = client.post(
        "/api/v1/auth/login",
        json={"identifier": email, "password": "TestPass1"},
    )
    assert resp.status_code == 200
    assert resp.json()["user"]["is_email_verified"] is True
