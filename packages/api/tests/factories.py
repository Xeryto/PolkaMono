"""Shared factory helpers for tests."""

import uuid
from datetime import datetime, timedelta, timezone

from auth_service import auth_service
from models import (
    AuthAccount,
    Brand,
    Category,
    Checkout,
    Friendship,
    Order,
    OrderItem,
    OrderStatus,
    Product,
    ProductColorVariant,
    ProductStyle,
    ProductVariant,
    Style,
    User,
    UserLikedProduct,
    UserProfile,
    UserShippingInfo,
    UserSwipe,
)


def create_test_user(db_session, email=None, username=None, password="TestPass1"):
    """Create AuthAccount + User + UserProfile + UserShippingInfo with delivery fields filled."""
    email = email or f"user-{uuid.uuid4().hex[:8]}@test.com"
    username = username or f"user_{uuid.uuid4().hex[:8]}"
    password_hash = auth_service.hash_password(password)

    auth = AuthAccount(
        id=str(uuid.uuid4()),
        email=email,
        password_hash=password_hash,
        is_email_verified=False,
    )
    db_session.add(auth)
    db_session.flush()

    user = User(
        id=str(uuid.uuid4()),
        username=username,
        auth_account_id=auth.id,
    )
    db_session.add(user)
    db_session.flush()

    profile = UserProfile(
        id=str(uuid.uuid4()),
        user_id=user.id,
        full_name="Test User",
    )
    db_session.add(profile)

    shipping = UserShippingInfo(
        id=str(uuid.uuid4()),
        user_id=user.id,
        delivery_email=email,
        phone="+71234567890",
        street="Тестовая улица",
        house_number="1",
        city="Москва",
        postal_code="123456",
    )
    db_session.add(shipping)
    db_session.commit()
    db_session.refresh(user)
    return user


def create_test_brand_with_product(db_session, stock=10, price=1000.0):
    """Create AuthAccount + Brand + Category + Product + ColorVariant + Variant."""
    brand_email = f"brand-{uuid.uuid4().hex[:8]}@test.com"
    brand_password_hash = auth_service.hash_password("BrandPass1")

    auth = AuthAccount(
        id=str(uuid.uuid4()),
        email=brand_email,
        password_hash=brand_password_hash,
        is_email_verified=True,
    )
    db_session.add(auth)
    db_session.flush()

    brand = Brand(
        id=str(uuid.uuid4()),
        name=f"Brand_{uuid.uuid4().hex[:6]}",
        auth_account_id=auth.id,
        slug=f"brand-{uuid.uuid4().hex[:6]}",
        shipping_price=350.0,
        min_free_shipping=5000,
    )
    db_session.add(brand)
    db_session.flush()

    cat = db_session.query(Category).filter(Category.id == "test-cat").first()
    if not cat:
        cat = Category(id="test-cat", name="Test Category")
        db_session.add(cat)
        db_session.flush()

    product = Product(
        id=str(uuid.uuid4()),
        name=f"Product_{uuid.uuid4().hex[:6]}",
        price=price,
        brand_id=brand.id,
        category_id=cat.id,
        purchase_count=0,
        general_images=["https://img.test/1.jpg"],
    )
    db_session.add(product)
    db_session.flush()

    color_variant = ProductColorVariant(
        id=str(uuid.uuid4()),
        product_id=product.id,
        color_name="Black",
        color_hex="#000000",
        images=["https://img.test/black.jpg"],
    )
    db_session.add(color_variant)
    db_session.flush()

    variant = ProductVariant(
        id=str(uuid.uuid4()),
        product_color_variant_id=color_variant.id,
        size="M",
        stock_quantity=stock,
    )
    db_session.add(variant)
    db_session.commit()
    db_session.refresh(brand)
    db_session.refresh(product)
    db_session.refresh(variant)
    return brand, product, variant


def make_token(user):
    """Create an access token for a user."""
    return auth_service.create_access_token(data={"sub": user.id})


def make_brand_token(brand):
    """Create an access token for a brand."""
    return auth_service.create_access_token(
        data={"sub": str(brand.id), "is_brand": True}
    )


def make_admin_token(db_session):
    """Create an admin AuthAccount and return its access token."""
    auth = AuthAccount(
        id=str(uuid.uuid4()),
        email=f"admin-{uuid.uuid4().hex[:8]}@test.com",
        password_hash=auth_service.hash_password("AdminPass1"),
        is_email_verified=True,
        is_admin=True,
    )
    db_session.add(auth)
    db_session.commit()
    return auth_service.create_access_token(
        data={"sub": str(auth.id), "is_admin": True}
    )


def auth_header(token):
    """Return Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}


def create_order_in_db(
    db_session,
    user,
    brand,
    variant,
    qty=1,
    price=1000.0,
    status=OrderStatus.CREATED,
    expires_at=None,
):
    """Create Checkout + Order + OrderItem directly in DB. Decrements stock."""
    from config import settings

    checkout = Checkout(user_id=user.id, total_amount=qty * price)
    db_session.add(checkout)
    db_session.flush()
    if expires_at is None:
        expires_at = datetime.now(timezone.utc) + timedelta(
            hours=settings.ORDER_PENDING_EXPIRY_HOURS
        )
    order = Order(
        checkout_id=checkout.id,
        brand_id=brand.id,
        order_number=str(uuid.uuid4().hex[:5]),
        user_id=user.id,
        total_amount=qty * price,
        status=status,
        expires_at=expires_at,
    )
    db_session.add(order)
    db_session.flush()
    oi = OrderItem(
        order_id=order.id,
        product_variant_id=variant.id,
        quantity=qty,
        price=price,
    )
    db_session.add(oi)
    variant.stock_quantity -= qty
    db_session.commit()
    db_session.refresh(order)
    return order


def create_test_style(db_session, name=None):
    """Create a Style row."""
    sid = uuid.uuid4().hex[:8]
    style = Style(
        id=f"style-{sid}",
        name=name or f"Style {sid}",
    )
    db_session.add(style)
    db_session.commit()
    db_session.refresh(style)
    return style


def create_test_category(db_session, name=None):
    """Create a Category row."""
    cid = uuid.uuid4().hex[:8]
    cat = Category(
        id=f"cat-{cid}",
        name=name or f"Category {cid}",
    )
    db_session.add(cat)
    db_session.commit()
    db_session.refresh(cat)
    return cat


def create_friend_pair(db_session, user1, user2):
    """Create an accepted friendship between two users."""
    friendship = Friendship(
        user_id=user1.id,
        friend_id=user2.id,
    )
    db_session.add(friendship)
    db_session.commit()
    return friendship


def create_product_with_styles(db_session, brand, category, styles=None, price=1000.0):
    """Create Product + ColorVariant + Variant, optionally linked to styles."""
    product = Product(
        id=str(uuid.uuid4()),
        name=f"Product_{uuid.uuid4().hex[:6]}",
        price=price,
        brand_id=brand.id,
        category_id=category.id,
        purchase_count=0,
        general_images=["https://img.test/1.jpg"],
    )
    db_session.add(product)
    db_session.flush()

    if styles:
        for s in styles:
            db_session.add(ProductStyle(product_id=product.id, style_id=s.id))
        db_session.flush()

    cv = ProductColorVariant(
        id=str(uuid.uuid4()),
        product_id=product.id,
        color_name="Black",
        color_hex="#000000",
        images=["https://img.test/black.jpg"],
    )
    db_session.add(cv)
    db_session.flush()

    variant = ProductVariant(
        id=str(uuid.uuid4()),
        product_color_variant_id=cv.id,
        size="M",
        stock_quantity=10,
    )
    db_session.add(variant)
    db_session.commit()
    db_session.refresh(product)
    db_session.refresh(variant)
    return product, variant


def create_user_like(db_session, user, product):
    """Create a UserLikedProduct row."""
    like = UserLikedProduct(user_id=user.id, product_id=product.id)
    db_session.add(like)
    db_session.commit()
    return like


def create_user_swipe(db_session, user, product, created_at=None):
    """Create a UserSwipe row."""
    swipe = UserSwipe(user_id=user.id, product_id=product.id)
    db_session.add(swipe)
    db_session.flush()
    if created_at:
        swipe.created_at = created_at
    db_session.commit()
    return swipe


def register_and_login(client_fixture, email=None, username=None, password="TestPass1"):
    """Register via API, return (token, user_id, refresh_token)."""
    email = email or f"user-{uuid.uuid4().hex[:8]}@test.com"
    username = username or f"user_{uuid.uuid4().hex[:8]}"
    resp = client_fixture.post(
        "/api/v1/auth/register",
        json={
            "username": username,
            "email": email,
            "password": password,
        },
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return data["token"], data["user"]["id"], data.get("refresh_token")
