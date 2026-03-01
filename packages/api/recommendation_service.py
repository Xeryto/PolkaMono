"""
Heuristic recommendation engine.

Scores products based on style match, brand affinity, category frequency,
price similarity, size availability, popularity, and recency.
"""

import logging
import math
import random
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

from sqlalchemy import func, exists, and_
from sqlalchemy.orm import Session, joinedload

from models import (
    Brand,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductColorVariant,
    ProductStyle,
    ProductVariant,
    User,
    UserLikedProduct,
    UserSwipe,
)


# ---------------------------------------------------------------------------
# User context (cached per user)
# ---------------------------------------------------------------------------

@dataclass
class UserRecoContext:
    style_ids: Set[str]
    brand_ids: Set[str]
    category_freq: Dict[str, float]  # category_id -> normalized 0-1
    median_price: Optional[float]
    price_stddev: Optional[float]
    selected_size: Optional[str]


# Module-level cache: user_id -> (timestamp, context)
_user_ctx_cache: Dict[str, Tuple[float, UserRecoContext]] = {}
_user_ctx_lock = threading.Lock()
_USER_CTX_TTL = 5 * 60  # 5 minutes


def _invalidate_user_ctx(user_id: str):
    with _user_ctx_lock:
        _user_ctx_cache.pop(user_id, None)


def build_user_context(db: Session, user: User) -> UserRecoContext:
    now = time.time()
    with _user_ctx_lock:
        cached = _user_ctx_cache.get(user.id)
        if cached and (now - cached[0]) < _USER_CTX_TTL:
            return cached[1]

    style_ids = {us.style_id for us in user.favorite_styles}
    brand_ids = {ub.brand_id for ub in user.favorite_brands}

    # Category frequency from likes (weight 1) + purchases (weight 3)
    cat_counts: Dict[str, float] = {}

    # Likes
    liked_rows = (
        db.query(Product.category_id, Product.price)
        .join(UserLikedProduct, UserLikedProduct.product_id == Product.id)
        .filter(UserLikedProduct.user_id == user.id)
        .all()
    )
    prices: List[float] = []
    for cat_id, price in liked_rows:
        cat_counts[cat_id] = cat_counts.get(cat_id, 0) + 1.0
        prices.append(price)

    # Purchases (weight 3x)
    purchased_rows = (
        db.query(Product.category_id, Product.price)
        .join(ProductColorVariant, ProductColorVariant.product_id == Product.id)
        .join(ProductVariant, ProductVariant.product_color_variant_id == ProductColorVariant.id)
        .join(OrderItem, OrderItem.product_variant_id == ProductVariant.id)
        .join(Order, Order.id == OrderItem.order_id)
        .filter(
            Order.user_id == user.id,
            Order.status.in_([OrderStatus.PAID, OrderStatus.SHIPPED]),
        )
        .all()
    )
    for cat_id, price in purchased_rows:
        cat_counts[cat_id] = cat_counts.get(cat_id, 0) + 3.0
        prices.append(price)

    # Normalize category freq to 0-1
    max_count = max(cat_counts.values()) if cat_counts else 1.0
    category_freq = {k: v / max_count for k, v in cat_counts.items()}

    # Price stats
    median_price = None
    price_stddev = None
    if prices:
        prices.sort()
        mid = len(prices) // 2
        median_price = prices[mid] if len(prices) % 2 else (prices[mid - 1] + prices[mid]) / 2
        if len(prices) >= 2:
            mean = sum(prices) / len(prices)
            price_stddev = math.sqrt(sum((p - mean) ** 2 for p in prices) / len(prices))

    selected_size = None
    if user.profile:
        selected_size = user.profile.selected_size

    ctx = UserRecoContext(
        style_ids=style_ids,
        brand_ids=brand_ids,
        category_freq=category_freq,
        median_price=median_price,
        price_stddev=price_stddev,
        selected_size=selected_size,
    )
    with _user_ctx_lock:
        _user_ctx_cache[user.id] = (now, ctx)
    return ctx


# ---------------------------------------------------------------------------
# Candidate row (lightweight projection)
# ---------------------------------------------------------------------------

@dataclass
class CandidateRow:
    id: str
    brand_id: str
    category_id: str
    price: float
    purchase_count: int
    created_at: datetime
    style_ids: Set[str] = field(default_factory=set)


# ---------------------------------------------------------------------------
# Phase 1: SQL pre-filter
# ---------------------------------------------------------------------------

def _fetch_candidates(
    db: Session,
    exclude_user_id: str,
    user_size: Optional[str],
    pool_size: int = 200,
) -> List[CandidateRow]:
    """Fetch candidate products, excluding recently swiped ones and inactive brands."""

    # Subquery: product IDs swiped in the last 30 days (older swipes can resurface)
    swipe_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    swiped_sub = (
        db.query(UserSwipe.product_id)
        .filter(
            UserSwipe.user_id == exclude_user_id,
            UserSwipe.created_at >= swipe_cutoff,
        )
        .subquery()
    )

    q = (
        db.query(
            Product.id,
            Product.brand_id,
            Product.category_id,
            Product.price,
            Product.purchase_count,
            Product.created_at,
        )
        .join(Brand, Brand.id == Product.brand_id)
        .filter(
            Brand.is_inactive == False,  # noqa: E712
            ~Product.id.in_(swiped_sub),
        )
    )

    # If user has a size, prefer products that have it in stock
    if user_size:
        size_exists = (
            exists()
            .where(
                and_(
                    ProductColorVariant.product_id == Product.id,
                    ProductVariant.product_color_variant_id == ProductColorVariant.id,
                    ProductVariant.size == user_size,
                    ProductVariant.stock_quantity > 0,
                )
            )
        )
        # Order products with user's size first, then others
        q = q.order_by(size_exists.desc(), func.random())
    else:
        q = q.order_by(func.random())

    rows = q.limit(pool_size).all()

    if not rows:
        return []

    product_ids = [r[0] for r in rows]

    # Batch-load style IDs for candidates
    style_rows = (
        db.query(ProductStyle.product_id, ProductStyle.style_id)
        .filter(ProductStyle.product_id.in_(product_ids))
        .all()
    )
    style_map: Dict[str, Set[str]] = {}
    for pid, sid in style_rows:
        style_map.setdefault(pid, set()).add(sid)

    candidates = []
    for pid, brand_id, cat_id, price, pcount, created in rows:
        candidates.append(
            CandidateRow(
                id=pid,
                brand_id=brand_id,
                category_id=cat_id,
                price=price,
                purchase_count=pcount,
                created_at=created,
                style_ids=style_map.get(pid, set()),
            )
        )
    return candidates


# ---------------------------------------------------------------------------
# Phase 2: Scoring (pure function)
# ---------------------------------------------------------------------------

# Weights
W_STYLE = 0.30
W_BRAND = 0.20
W_CATEGORY = 0.15
W_PRICE = 0.10
W_SIZE = 0.10
W_POPULARITY = 0.10
W_RECENCY = 0.05


@dataclass
class ScoreBreakdown:
    total: float
    style: float
    brand: float
    category: float
    price: float
    size: float
    popularity: float
    recency: float
    bonus: float = 0.0  # friend-liked bonus etc.


def _score_product(
    c: CandidateRow,
    ctx: UserRecoContext,
    max_purchase_count: int,
    now: datetime,
) -> ScoreBreakdown:
    # Style match
    if c.style_ids:
        style_score = len(c.style_ids & ctx.style_ids) / len(c.style_ids)
    else:
        style_score = 0.0

    # Brand match
    brand_score = 1.0 if c.brand_id in ctx.brand_ids else 0.0

    # Category affinity
    cat_score = ctx.category_freq.get(c.category_id, 0.0)

    # Price affinity (Gaussian)
    if ctx.median_price is not None and ctx.price_stddev and ctx.price_stddev > 0:
        diff = abs(c.price - ctx.median_price)
        price_score = math.exp(-0.5 * (diff / ctx.price_stddev) ** 2)
    else:
        price_score = 1.0  # no penalty for cold start

    # Size in stock (approximated — full check done in fetch)
    if ctx.selected_size:
        size_score = 1.0  # candidates were pre-filtered; assume in stock
    else:
        size_score = 0.5

    # Popularity
    if max_purchase_count > 0:
        pop_score = math.log(1 + c.purchase_count) / math.log(1 + max_purchase_count)
    else:
        pop_score = 0.0

    # Recency
    days_old = max((now - c.created_at).days, 0)
    recency_score = math.exp(-days_old / 60)

    total = (
        W_STYLE * style_score
        + W_BRAND * brand_score
        + W_CATEGORY * cat_score
        + W_PRICE * price_score
        + W_SIZE * size_score
        + W_POPULARITY * pop_score
        + W_RECENCY * recency_score
    )

    # Exploration noise
    total += random.uniform(0, 0.05)

    return ScoreBreakdown(
        total=total,
        style=style_score,
        brand=brand_score,
        category=cat_score,
        price=price_score,
        size=size_score,
        popularity=pop_score,
        recency=recency_score,
    )


# ---------------------------------------------------------------------------
# Phase 3: Diversity pass
# ---------------------------------------------------------------------------

def _diversify(
    scored: List[Tuple[ScoreBreakdown, CandidateRow]],
    limit: int,
    max_per_brand: int = 3,
    max_per_category: int = 4,
) -> List[Tuple[str, ScoreBreakdown]]:
    """Return up to `limit` (product_id, breakdown) tuples with brand/category diversity."""
    brand_counts: Dict[str, int] = {}
    cat_counts: Dict[str, int] = {}
    result: List[Tuple[str, ScoreBreakdown]] = []
    overflow: List[Tuple[str, ScoreBreakdown]] = []

    for bd, c in scored:
        if len(result) >= limit:
            break
        bc = brand_counts.get(c.brand_id, 0)
        cc = cat_counts.get(c.category_id, 0)
        if bc < max_per_brand and cc < max_per_category:
            result.append((c.id, bd))
            brand_counts[c.brand_id] = bc + 1
            cat_counts[c.category_id] = cc + 1
        else:
            overflow.append((c.id, bd))

    # Backfill from overflow if needed
    for item in overflow:
        if len(result) >= limit:
            break
        result.append(item)

    return result


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def _log_context(ctx: UserRecoContext, user_id: str, label: str):
    logger.info(
        "[reco:%s] user=%s styles=%s brands=%s cat_freq=%s "
        "median_price=%s price_std=%s size=%s",
        label, user_id[:8],
        ctx.style_ids or "{}",
        ctx.brand_ids or "{}",
        {k: round(v, 2) for k, v in ctx.category_freq.items()} or "{}",
        round(ctx.median_price, 2) if ctx.median_price else None,
        round(ctx.price_stddev, 2) if ctx.price_stddev else None,
        ctx.selected_size,
    )


def _log_top_scores(top: List[Tuple[str, ScoreBreakdown]], label: str):
    for rank, (pid, bd) in enumerate(top, 1):
        logger.info(
            "[reco:%s] #%d id=%s total=%.3f  "
            "sty=%.2f brn=%.2f cat=%.2f prc=%.2f siz=%.2f pop=%.2f rec=%.2f bon=%.2f",
            label, rank, pid[:8], bd.total,
            bd.style, bd.brand, bd.category, bd.price,
            bd.size, bd.popularity, bd.recency, bd.bonus,
        )


def get_recommendations_for_user(
    db: Session,
    user: User,
    limit: int = 5,
) -> List[Product]:
    ctx = build_user_context(db, user)
    _log_context(ctx, user.id, "for_user")

    candidates = _fetch_candidates(db, exclude_user_id=user.id, user_size=ctx.selected_size)
    logger.info("[reco:for_user] %d candidates after pre-filter", len(candidates))

    if not candidates:
        return []

    now = datetime.now(timezone.utc)
    max_pc = max(c.purchase_count for c in candidates)

    scored = sorted(
        [(_score_product(c, ctx, max_pc, now), c) for c in candidates],
        key=lambda x: x[0].total,
        reverse=True,
    )

    top = _diversify(scored, limit)
    _log_top_scores(top, "for_user")

    top_ids = [pid for pid, _ in top]
    if not top_ids:
        return []

    # Fetch full Product objects with eager loads
    products = (
        db.query(Product)
        .options(
            joinedload(Product.styles),
            joinedload(Product.color_variants).joinedload(ProductColorVariant.variants),
            joinedload(Product.brand),
        )
        .filter(Product.id.in_(top_ids))
        .all()
    )

    # Preserve score order
    order_map = {pid: i for i, pid in enumerate(top_ids)}
    products.sort(key=lambda p: order_map.get(p.id, 999))
    return products


def get_recommendations_for_friend(
    db: Session,
    friend: User,
    viewer: User,
    limit: int = 8,
) -> List[Product]:
    """Recommend products matching friend's taste, excluding viewer's swipes."""
    ctx = build_user_context(db, friend)
    _log_context(ctx, friend.id, "for_friend")

    # Exclude viewer's swipes so they don't see repeats
    candidates = _fetch_candidates(db, exclude_user_id=viewer.id, user_size=ctx.selected_size)
    logger.info("[reco:for_friend] %d candidates (friend=%s, viewer=%s)",
                len(candidates), friend.id[:8], viewer.id[:8])

    if not candidates:
        return []

    # Bonus for products friend has liked
    friend_liked = set(
        pid
        for (pid,) in db.query(UserLikedProduct.product_id).filter(
            UserLikedProduct.user_id == friend.id
        )
    )

    now = datetime.now(timezone.utc)
    max_pc = max(c.purchase_count for c in candidates)

    scored = []
    for c in candidates:
        bd = _score_product(c, ctx, max_pc, now)
        if c.id in friend_liked:
            bd.bonus = 0.15
            bd.total += 0.15
        scored.append((bd, c))

    scored.sort(key=lambda x: x[0].total, reverse=True)

    top = _diversify(scored, limit)
    _log_top_scores(top, "for_friend")

    top_ids = [pid for pid, _ in top]
    if not top_ids:
        return []

    products = (
        db.query(Product)
        .options(
            joinedload(Product.styles),
            joinedload(Product.color_variants).joinedload(ProductColorVariant.variants),
            joinedload(Product.brand),
        )
        .filter(Product.id.in_(top_ids))
        .all()
    )

    order_map = {pid: i for i, pid in enumerate(top_ids)}
    products.sort(key=lambda p: order_map.get(p.id, 999))
    return products
