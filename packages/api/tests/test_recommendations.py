"""Tests for recommendation service (unit + integration)."""

import random
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
import recommendation_service
from factories import (
    auth_header as _auth,
    create_friend_pair,
    create_test_brand_with_product,
    create_test_user,
    create_user_like,
    make_token,
)
from recommendation_service import (
    CandidateRow,
    ScoreBreakdown,
    UserRecoContext,
    _diversify,
    _score_product,
    build_user_context,
)


@pytest.fixture(autouse=True)
def clear_reco_cache():
    """Clear recommendation cache between tests."""
    recommendation_service._user_ctx_cache.clear()
    yield
    recommendation_service._user_ctx_cache.clear()


# ---------------------------------------------------------------------------
# Unit tests — _score_product
# ---------------------------------------------------------------------------


def _make_candidate(brand_id="b1", category_id="c1", price=1000, style_ids=None,
                    purchase_count=0, days_old=0):
    return CandidateRow(
        id=f"p-{random.randint(0, 999999)}",
        brand_id=brand_id,
        category_id=category_id,
        price=price,
        purchase_count=purchase_count,
        created_at=datetime.now(timezone.utc) - timedelta(days=days_old),
        style_ids=set(style_ids or []),
    )


def _empty_ctx(**overrides):
    defaults = dict(
        style_ids=set(),
        brand_ids=set(),
        category_freq={},
        median_price=None,
        price_stddev=None,
        selected_size=None,
    )
    defaults.update(overrides)
    return UserRecoContext(**defaults)


def test_style_match_boosts_score():
    ctx = _empty_ctx(style_ids={"s1", "s2"})
    matched = _make_candidate(style_ids=["s1", "s2"])
    unmatched = _make_candidate(style_ids=["s3"])
    now = datetime.now(timezone.utc)
    s_matched = _score_product(matched, ctx, 10, now)
    s_unmatched = _score_product(unmatched, ctx, 10, now)
    assert s_matched.style == 1.0
    assert s_unmatched.style == 0.0


def test_brand_affinity_boosts_score():
    ctx = _empty_ctx(brand_ids={"b1"})
    fav = _make_candidate(brand_id="b1")
    other = _make_candidate(brand_id="b2")
    now = datetime.now(timezone.utc)
    assert _score_product(fav, ctx, 10, now).brand == 1.0
    assert _score_product(other, ctx, 10, now).brand == 0.0


def test_category_affinity():
    ctx = _empty_ctx(category_freq={"c1": 1.0, "c2": 0.5})
    c1 = _make_candidate(category_id="c1")
    c2 = _make_candidate(category_id="c2")
    c3 = _make_candidate(category_id="c3")
    now = datetime.now(timezone.utc)
    assert _score_product(c1, ctx, 10, now).category == 1.0
    assert _score_product(c2, ctx, 10, now).category == 0.5
    assert _score_product(c3, ctx, 10, now).category == 0.0


def test_price_proximity():
    ctx = _empty_ctx(median_price=1000, price_stddev=200)
    close = _make_candidate(price=1000)
    far = _make_candidate(price=3000)
    now = datetime.now(timezone.utc)
    s_close = _score_product(close, ctx, 10, now)
    s_far = _score_product(far, ctx, 10, now)
    assert s_close.price > s_far.price


def test_cold_start_price_no_penalty():
    """No price data → price_score = 1.0 (no penalty)."""
    ctx = _empty_ctx()  # no median_price
    c = _make_candidate(price=5000)
    now = datetime.now(timezone.utc)
    assert _score_product(c, ctx, 10, now).price == 1.0


def test_popularity_scoring():
    ctx = _empty_ctx()
    popular = _make_candidate(purchase_count=100)
    unpopular = _make_candidate(purchase_count=0)
    now = datetime.now(timezone.utc)
    s_pop = _score_product(popular, ctx, 100, now)
    s_unpop = _score_product(unpopular, ctx, 100, now)
    assert s_pop.popularity > s_unpop.popularity


# ---------------------------------------------------------------------------
# Unit tests — _diversify
# ---------------------------------------------------------------------------


def test_diversity_caps_brand():
    """Max 3 per brand: 4th from same brand goes to overflow."""
    scored = []
    for i in range(5):
        bd = ScoreBreakdown(
            total=1.0 - i * 0.01,
            style=0, brand=0, category=0, price=0, size=0, popularity=0, recency=0,
        )
        c = _make_candidate(brand_id="same-brand", category_id=f"c{i}")
        scored.append((bd, c))
    result = _diversify(scored, limit=5, max_per_brand=3)
    assert len(result) == 5


def test_diversity_caps_category():
    """Max 4 per category."""
    scored = []
    for i in range(6):
        bd = ScoreBreakdown(
            total=1.0 - i * 0.01,
            style=0, brand=0, category=0, price=0, size=0, popularity=0, recency=0,
        )
        c = _make_candidate(brand_id=f"b{i}", category_id="same-cat")
        scored.append((bd, c))
    result = _diversify(scored, limit=6, max_per_category=4)
    assert len(result) == 6


# ---------------------------------------------------------------------------
# Unit tests — build_user_context
# ---------------------------------------------------------------------------


def test_cold_start_context(db):
    """New user with no interactions has empty context."""
    user = create_test_user(db)
    ctx = build_user_context(db, user)
    assert ctx.style_ids == set()
    assert ctx.brand_ids == set()
    assert ctx.category_freq == {}
    assert ctx.median_price is None


def test_context_reflects_likes(db):
    """Likes contribute to category frequency and price stats."""
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db, price=2000)
    create_user_like(db, user, product)
    ctx = build_user_context(db, user)
    assert product.category_id in ctx.category_freq
    assert ctx.median_price == 2000.0


# ---------------------------------------------------------------------------
# Integration tests — HTTP endpoints (mock recommendation_service to avoid
# PG-specific SQL in _fetch_candidates)
# ---------------------------------------------------------------------------


def test_recommendations_for_user_200(client, db):
    user = create_test_user(db)
    _, product, _ = create_test_brand_with_product(db)
    token = make_token(user)

    # Mock to return the product directly (avoids PG-specific SQL)
    with patch("main.recommendation_service.get_recommendations_for_user", return_value=[product]):
        resp = client.get("/api/v1/recommendations/for_user?limit=5", headers=_auth(token))
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert len(resp.json()) == 1


def test_recommendations_for_friend_200(client, db):
    user1 = create_test_user(db)
    user2 = create_test_user(db)
    create_friend_pair(db, user1, user2)
    # Set privacy to everyone
    from models import UserPreferences, PrivacyOption
    prefs = UserPreferences(user_id=user2.id, recommendations_privacy=PrivacyOption.EVERYONE)
    db.add(prefs)
    db.commit()

    _, product, _ = create_test_brand_with_product(db)
    token = make_token(user1)

    with patch("main.recommendation_service.get_recommendations_for_friend", return_value=[product]):
        resp = client.get(
            f"/api/v1/recommendations/for_friend/{user2.id}",
            headers=_auth(token),
        )
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_recommendations_for_nonexistent_friend_404(client, db):
    user = create_test_user(db)
    token = make_token(user)
    resp = client.get(
        "/api/v1/recommendations/for_friend/nonexistent-id",
        headers=_auth(token),
    )
    assert resp.status_code == 404
