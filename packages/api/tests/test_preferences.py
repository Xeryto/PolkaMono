"""Tests for discovery preferences: brands, styles, categories."""

from factories import (
    auth_header as _auth,
    create_test_brand_with_product,
    create_test_category,
    create_test_style,
    create_test_user,
    make_token,
)


# ---------- list endpoints ----------


def test_list_brands(client, db):
    _, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/brands", headers=_auth(token))
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


def test_list_styles(client, db):
    create_test_style(db, name="Streetwear")
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/styles", headers=_auth(token))
    assert resp.status_code == 200
    assert any(s["name"] == "Streetwear" for s in resp.json())


def test_list_categories(client, db):
    create_test_category(db, name="Shoes")
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/categories", headers=_auth(token))
    assert resp.status_code == 200
    assert any(c["name"] == "Shoes" for c in resp.json())


# ---------- favorite brands ----------


def test_set_favorite_brands(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/brands",
        headers=_auth(token),
        json={"brand_ids": [str(brand.id)]},
    )
    assert resp.status_code == 200


def test_set_favorite_brands_duplicate_ok(client, db):
    brand, _, _ = create_test_brand_with_product(db)
    user = create_test_user(db)
    token = make_token(user)
    # Set twice — second should just replace
    client.post(
        "/api/v1/user/brands",
        headers=_auth(token),
        json={"brand_ids": [str(brand.id)]},
    )
    resp = client.post(
        "/api/v1/user/brands",
        headers=_auth(token),
        json={"brand_ids": [str(brand.id)]},
    )
    assert resp.status_code == 200


def test_set_favorite_brands_invalid_id(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/brands",
        headers=_auth(token),
        json={"brand_ids": ["nonexistent-brand-id"]},
    )
    assert resp.status_code == 400


# ---------- favorite styles ----------


def test_set_favorite_styles(client, db):
    style = create_test_style(db)
    user = create_test_user(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/styles",
        headers=_auth(token),
        json={"style_ids": [style.id]},
    )
    assert resp.status_code == 200


def test_set_favorite_styles_invalid_id(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.post(
        "/api/v1/user/styles",
        headers=_auth(token),
        json={"style_ids": ["nonexistent-style-id"]},
    )
    assert resp.status_code == 400
