"""Tests for product endpoints: detail, popular, search, brand CRUD."""

from factories import (
    auth_header as _auth,
    create_test_brand_with_product,
    create_test_category,
    create_test_user,
    create_product_with_styles,
    make_brand_token,
    make_token,
)


# ---------- product detail ----------


def test_product_detail_200(client, db):
    user = create_test_user(db)
    brand, product, _variant = create_test_brand_with_product(db)
    token = make_token(user)
    resp = client.get(f"/api/v1/products/{product.id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == product.id


def test_product_detail_404(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/products/nonexistent", headers=_auth(token))
    assert resp.status_code == 404


# ---------- popular ----------


def test_popular_products_sorted(client, db):
    user = create_test_user(db)
    brand, product1, _ = create_test_brand_with_product(db, price=500)
    product1.purchase_count = 10
    db.commit()
    _, product2, _ = create_test_brand_with_product(db, price=600)
    product2.purchase_count = 5
    db.commit()

    # Invalidate popular cache
    from main import invalidate_popular_items_cache
    invalidate_popular_items_cache()

    token = make_token(user)
    resp = client.get("/api/v1/products/popular?limit=10", headers=_auth(token))
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert ids.index(product1.id) < ids.index(product2.id)


# ---------- search ----------


def test_search_by_short_query(client, db):
    """Short query (<3 chars) uses ILIKE fallback."""
    user = create_test_user(db)
    brand, product, _ = create_test_brand_with_product(db)
    product.name = "XY Unique Shirt"
    db.commit()

    token = make_token(user)
    resp = client.get("/api/v1/products/search?query=XY", headers=_auth(token))
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert product.id in ids


def test_search_by_category(client, db):
    user = create_test_user(db)
    cat = create_test_category(db, name="Pants")
    brand, _, _ = create_test_brand_with_product(db)
    product, _ = create_product_with_styles(db, brand, cat, price=800)

    token = make_token(user)
    resp = client.get(f"/api/v1/products/search?category={cat.id}", headers=_auth(token))
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert product.id in ids


def test_search_no_results(client, db):
    user = create_test_user(db)
    token = make_token(user)
    # Use short query (<3 chars) to avoid PG-specific FTS path in SQLite tests
    resp = client.get(
        "/api/v1/products/search?query=zz", headers=_auth(token)
    )
    assert resp.status_code == 200
    assert resp.json() == []


# ---------- brand product CRUD ----------


def test_brand_get_own_products(client, db):
    brand, product, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get("/api/v1/brands/products", headers=_auth(token))
    assert resp.status_code == 200
    ids = [p["id"] for p in resp.json()]
    assert product.id in ids


def test_brand_get_product_detail(client, db):
    brand, product, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand)
    resp = client.get(f"/api/v1/brands/products/{product.id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["id"] == product.id


def test_user_cannot_access_brand_products(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get("/api/v1/brands/products", headers=_auth(token))
    assert resp.status_code == 403


def test_brand_cannot_see_other_brand_product(client, db):
    _brand1, product, _ = create_test_brand_with_product(db)
    brand2, _, _ = create_test_brand_with_product(db)
    token = make_brand_token(brand2)
    resp = client.get(f"/api/v1/brands/products/{product.id}", headers=_auth(token))
    assert resp.status_code == 403
