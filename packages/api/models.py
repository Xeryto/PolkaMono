"""
Database models for PolkaAPI
"""
from sqlalchemy import Column, String, Boolean, DateTime, Text, ForeignKey, Integer, Enum as SQLEnum, UniqueConstraint, Float, Index, TypeDecorator
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
import uuid
from enum import Enum
from datetime import datetime

Base = declarative_base()

class Gender(str, Enum):
    MALE = "male"
    FEMALE = "female"

class PrivacyOption(str, Enum):
    NOBODY = "nobody"
    FRIENDS = "friends"
    EVERYONE = "everyone"

class FriendRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    CANCELLED = "cancelled"

class AuthAccount(Base):
    """Shared auth credentials and verification for users and brands"""
    __tablename__ = "auth_accounts"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for OAuth-only users
    is_email_verified = Column(Boolean, default=False)
    email_verification_code = Column(String(6), nullable=True)
    email_verification_code_expires_at = Column(DateTime, nullable=True)
    password_reset_token = Column(String, nullable=True)
    password_reset_expires = Column(DateTime, nullable=True)
    password_history = Column(ARRAY(String), default=list)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    otp_code = Column(String(6), nullable=True)               # Current pending 2FA OTP (6-digit code)
    otp_code_expires_at = Column(DateTime, nullable=True)     # Expires 5 min from send
    otp_session_token = Column(String(64), nullable=True)     # secrets.token_hex(32) — ties OTP to login session; cleared after verify
    failed_otp_attempts = Column(Integer, default=0, nullable=False)  # Resets on success
    otp_locked_until = Column(DateTime, nullable=True)        # 15-min lockout after too many fails
    otp_resend_count = Column(Integer, default=0, nullable=False)     # Resets each login attempt
    otp_resend_window_start = Column(DateTime, nullable=True) # When current resend window started
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships (one account per user or per brand)
    user = relationship("User", back_populates="auth_account", uselist=False, cascade="all, delete-orphan")
    brand = relationship("Brand", back_populates="auth_account", uselist=False, cascade="all, delete-orphan")


class User(Base):
    """User model"""
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    auth_account_id = Column(String, ForeignKey("auth_accounts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete; when set, user is anonymized and access revoked
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    items_swiped = Column(Integer, default=0, nullable=False)  # Denormalized counter for stats (Option 2)

    # Relationships
    auth_account = relationship("AuthAccount", back_populates="user", uselist=False, lazy="joined")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
    favorite_brands = relationship("UserBrand", back_populates="user", cascade="all, delete-orphan")
    favorite_styles = relationship("UserStyle", back_populates="user", cascade="all, delete-orphan")
    
    # Friend relationships
    sent_friend_requests = relationship("FriendRequest", foreign_keys="FriendRequest.sender_id", back_populates="sender", cascade="all, delete-orphan")
    received_friend_requests = relationship("FriendRequest", foreign_keys="FriendRequest.recipient_id", back_populates="recipient", cascade="all, delete-orphan")
    friendships = relationship("Friendship", foreign_keys="Friendship.user_id", back_populates="user", cascade="all, delete-orphan")
    friends = relationship("Friendship", foreign_keys="Friendship.friend_id", back_populates="friend", cascade="all, delete-orphan")
    
    # Domain-specific relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    shipping_info = relationship("UserShippingInfo", back_populates="user", uselist=False, cascade="all, delete-orphan")
    preferences = relationship("UserPreferences", back_populates="user", uselist=False, cascade="all, delete-orphan")

class UserProfile(Base):
    """User profile information (separated from core user table)"""
    __tablename__ = "user_profiles"
    __table_args__ = {"extend_existing": True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    full_name = Column(String(255), nullable=True)
    gender = Column(SQLEnum(Gender), nullable=True)
    selected_size = Column(String(10), nullable=True)
    avatar_url = Column(String(500), nullable=True)  # Cropped display image URL
    avatar_url_full = Column(String(500), nullable=True)  # Full-size source for re-editing
    avatar_crop = Column(String(1000), nullable=True)  # JSON: normalized crop in full image (legacy)
    avatar_transform = Column(String(500), nullable=True)  # JSON: { scale, translateXPercent, translateYPercent } device-independent
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="profile")

class UserShippingInfo(Base):
    """User shipping/delivery information (separated from core user table)"""
    __tablename__ = "user_shipping_info"
    __table_args__ = {"extend_existing": True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    delivery_email = Column(String(255), nullable=True)
    phone = Column(String(20), nullable=True)
    street = Column(String(255), nullable=True)
    house_number = Column(String(50), nullable=True)
    apartment_number = Column(String(50), nullable=True)
    city = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="shipping_info")

class UserPreferences(Base):
    """User privacy and notification preferences (separated from core user table)"""
    __tablename__ = "user_preferences"
    __table_args__ = {"extend_existing": True}
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    # Privacy settings
    size_privacy = Column(SQLEnum(PrivacyOption), nullable=True, default=PrivacyOption.FRIENDS)
    recommendations_privacy = Column(SQLEnum(PrivacyOption), nullable=True, default=PrivacyOption.FRIENDS)
    likes_privacy = Column(SQLEnum(PrivacyOption), nullable=True, default=PrivacyOption.FRIENDS)
    # Notification settings
    order_notifications = Column(Boolean, default=True, nullable=False)
    marketing_notifications = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")

class OAuthAccount(Base):
    """OAuth account model for social login"""
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_oauth_user_provider"),
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_uid"),
        {"extend_existing": True},
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # google, facebook, github, apple
    provider_user_id = Column(String(255), nullable=False)
    access_token = Column(Text, nullable=True)
    refresh_token = Column(Text, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="oauth_accounts")

class Brand(Base):
    """Brand model"""
    __tablename__ = "brands"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)
    auth_account_id = Column(String, ForeignKey("auth_accounts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    slug = Column(String(100), unique=True, nullable=False)
    logo = Column(String(500), nullable=True)
    description = Column(String(1000), nullable=True)
    return_policy = Column(Text, nullable=True)
    min_free_shipping = Column(Integer, nullable=True)
    shipping_price = Column(Float, nullable=True)
    shipping_provider = Column(String(100), nullable=True)
    delivery_time_min = Column(Integer, nullable=True)  # days, e.g. 3
    delivery_time_max = Column(Integer, nullable=True)  # days, e.g. 7
    amount_withdrawn = Column(Float, nullable=False, default=0.0)
    inn = Column(String(20), nullable=True)
    registration_address = Column(Text, nullable=True)
    payout_account = Column(String(100), nullable=True)
    payout_account_locked = Column(Integer, nullable=False, default=0)
    is_inactive = Column(Boolean, default=False, nullable=False)
    scheduled_deletion_at = Column(DateTime, nullable=True)  # Set when brand requests deletion; null means active
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    auth_account = relationship("AuthAccount", back_populates="brand", uselist=False, lazy="joined")

class Style(Base):
    """Style model"""
    __tablename__ = "styles"
    
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Category(Base):
    """Category model for products"""
    __tablename__ = "categories"

    id = Column(String(50), primary_key=True) # e.g., "dresses", "shirts"
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UserBrand(Base):
    """User-Brand many-to-many relationship"""
    __tablename__ = "user_brands"
    __table_args__ = (
        UniqueConstraint("user_id", "brand_id", name="uq_user_brand"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorite_brands")
    brand = relationship("Brand")

class UserStyle(Base):
    """User-Style many-to-many relationship"""
    __tablename__ = "user_styles"
    __table_args__ = (
        UniqueConstraint("user_id", "style_id", name="uq_user_style"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    style_id = Column(String(50), ForeignKey("styles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="favorite_styles")
    style = relationship("Style")

class ProductStyle(Base):
    """Product-Style many-to-many association table"""
    __tablename__ = "product_styles"
    __table_args__ = {"extend_existing": True}

    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), primary_key=True)
    style_id = Column(String(50), ForeignKey("styles.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product", back_populates="styles")
    style = relationship("Style", back_populates="products")


class Product(Base):
    """Product model for recommendations. Images and color live on ProductColorVariant."""
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    description = Column(String(1000), nullable=True)
    price = Column(Float, nullable=False)
    material = Column(String(100), nullable=True)
    article_number = Column(String(50), nullable=True)  # Article number for user-facing identification, search, and sharing
    delivery_time_min = Column(Integer, nullable=True)  # per-product override; None = use brand default
    delivery_time_max = Column(Integer, nullable=True)
    sale_price = Column(Float, nullable=True)        # Reduced price (exact) or discount pct; None = no sale
    sale_type = Column(String(10), nullable=True)     # 'percent' or 'exact'; None when no active sale
    sizing_table_image = Column(String, nullable=True)  # S3 public URL of sizing table image
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="RESTRICT"), nullable=False)
    category_id = Column(String(50), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False)
    purchase_count = Column(Integer, nullable=False, default=0)  # Denormalized for performance
    general_images = Column(ARRAY(String), nullable=True)  # Images shown for all color variants
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    brand = relationship("Brand")
    category = relationship("Category")
    styles = relationship("ProductStyle", back_populates="product", cascade="all, delete-orphan")
    color_variants = relationship("ProductColorVariant", back_populates="product", cascade="all, delete-orphan", order_by="ProductColorVariant.display_order")

    __table_args__ = (
        Index('idx_product_purchase_count', 'purchase_count'),
        Index('idx_product_article_number', 'article_number'),
        UniqueConstraint('article_number', name='uq_product_article_number'),
    )


class ProductColorVariant(Base):
    """One color variation of a product: its own images and size/stock variants."""
    __tablename__ = "product_color_variants"
    __table_args__ = (
        UniqueConstraint('product_id', 'color_name', name='uq_product_color'),
        {"extend_existing": True},
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    color_name = Column(String(50), nullable=False)  # Canonical name (e.g. Black, Blue)
    color_hex = Column(String(50), nullable=False)    # Hex for UI (e.g. #000000)
    images = Column(ARRAY(String), nullable=True)    # Image URLs for this color
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    product = relationship("Product", back_populates="color_variants")
    variants = relationship("ProductVariant", back_populates="color_variant", cascade="all, delete-orphan")


class ProductVariant(Base):
    """Size and stock for a specific product color variant."""
    __tablename__ = "product_variants"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    product_color_variant_id = Column(String, ForeignKey("product_color_variants.id", ondelete="CASCADE"), nullable=False)
    size = Column(String(10), nullable=False)
    stock_quantity = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    color_variant = relationship("ProductColorVariant", back_populates="variants")

    @property
    def product(self):
        """Convenience access to Product from color_variant (for order/payment code)."""
        return self.color_variant.product if self.color_variant else None

    __table_args__ = (
        UniqueConstraint('product_color_variant_id', 'size', name='uq_color_variant_size'),
    )

class UserLikedProduct(Base):
    """User-Product many-to-many relationship for liked items"""
    __tablename__ = "user_liked_products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="liked_products")
    product = relationship("Product")
    
    __table_args__ = (
        UniqueConstraint("user_id", "product_id", name="uq_user_liked_product"),
        {"extend_existing": True},
    )

# Add liked_products relationship to User model
User.liked_products = relationship("UserLikedProduct", back_populates="user", cascade="all, delete-orphan")

class UserSwipe(Base):
    """User swipe tracking for analytics and recommendations (single signal: user saw product)"""
    __tablename__ = "user_swipes"
    __table_args__ = (
        Index('idx_user_swipes_user_created', 'user_id', 'created_at'),  # For "last N swipes" per user
        Index('idx_user_swipes_product_id', 'product_id'),
        {"extend_existing": True},
    )
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(String, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User")
    product = relationship("Product")

class FriendRequest(Base):
    """Friend request model"""
    __tablename__ = "friend_requests"
    __table_args__ = (
        UniqueConstraint("sender_id", "recipient_id", name="uq_friend_request_pair"),
        {"extend_existing": True},
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipient_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(SQLEnum(FriendRequestStatus), default=FriendRequestStatus.PENDING, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_friend_requests")
    recipient = relationship("User", foreign_keys=[recipient_id], back_populates="received_friend_requests")

class Friendship(Base):
    """Friendship model for accepted friend relationships"""
    __tablename__ = "friendships"
    __table_args__ = (
        UniqueConstraint("user_id", "friend_id", name="uq_friendship_pair"),
        {"extend_existing": True},
    )

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    friend_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", foreign_keys=[user_id], back_populates="friendships")
    friend = relationship("User", foreign_keys=[friend_id], back_populates="friends")

# Add products relationship to Style model
Style.products = relationship("ProductStyle", back_populates="style", cascade="all, delete-orphan")


class Checkout(Base):
    """Ozon-style: one Checkout per payment session. Groups Orders (one per brand)."""
    __tablename__ = "checkouts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    total_amount = Column(Float, nullable=False)
    delivery_full_name = Column(String(255), nullable=True)
    delivery_email = Column(String(255), nullable=True)
    delivery_phone = Column(String(20), nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_city = Column(String(100), nullable=True)
    delivery_postal_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    orders = relationship("Order", back_populates="checkout", cascade="all, delete-orphan")
    payment = relationship("Payment", back_populates="checkout", uselist=False, cascade="all, delete-orphan")


class OrderStatus(str, Enum):
    """Canonical order status. Values are lowercase; API returns these strings.
    Keep in sync with packages/shared orderStatus.ts and schemas.ORDER_STATUS_VALUES."""
    CREATED = "created"
    PENDING = "pending"
    PAID = "paid"
    SHIPPED = "shipped"
    RETURNED = "returned"
    PARTIALLY_RETURNED = "partially_returned"
    CANCELED = "canceled"


# PostgreSQL orderstatus enum has mixed values: PENDING, PAID, CANCELED (uppercase)
# and shipped, returned, created, partially_returned (lowercase, added by migration). Map accordingly.
_ORDER_STATUS_TO_DB = {
    OrderStatus.CREATED: "created",
    OrderStatus.PENDING: "PENDING",
    OrderStatus.PAID: "PAID",
    OrderStatus.SHIPPED: "shipped",
    OrderStatus.RETURNED: "returned",
    OrderStatus.PARTIALLY_RETURNED: "partially_returned",
    OrderStatus.CANCELED: "CANCELED",
}


class OrderStatusType(TypeDecorator):
    """Binds OrderStatus to PostgreSQL orderstatus enum (mixed case: see _ORDER_STATUS_TO_DB)."""
    impl = String(20)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, OrderStatus):
            return _ORDER_STATUS_TO_DB[value]
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        s = str(value)
        try:
            return OrderStatus[s]  # uppercase e.g. PAID
        except KeyError:
            return OrderStatus(s.lower())  # lowercase e.g. shipped


class Order(Base):
    """Ozon-style: one Order per brand within a Checkout. Has its own tracking and status."""
    __tablename__ = "orders"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    checkout_id = Column(String, ForeignKey("checkouts.id", ondelete="CASCADE"), nullable=True)  # Nullable for migration
    brand_id = Column(Integer, ForeignKey("brands.id", ondelete="RESTRICT"), nullable=True)  # Nullable for migration
    order_number = Column(String, unique=True, nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="RESTRICT"), nullable=True)  # Denorm for legacy/queries
    subtotal = Column(Float, nullable=True)  # Items only; nullable for migration
    shipping_cost = Column(Float, nullable=True)  # Per-brand delivery; nullable for migration
    total_amount = Column(Float, nullable=False)
    status = Column(OrderStatusType, default=OrderStatus.PENDING, nullable=False)
    tracking_number = Column(String(255), nullable=True)
    tracking_link = Column(String(500), nullable=True)
    # Legacy delivery fields (for pre-Checkout orders; new orders get from checkout)
    delivery_full_name = Column(String(255), nullable=True)
    delivery_email = Column(String(255), nullable=True)
    delivery_phone = Column(String(20), nullable=True)
    delivery_address = Column(Text, nullable=True)
    delivery_city = Column(String(100), nullable=True)
    delivery_postal_code = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # Cutoff for unpaid CREATED/PENDING orders

    checkout = relationship("Checkout", back_populates="orders")
    brand = relationship("Brand")
    user = relationship("User")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    status_events = relationship("OrderStatusEvent", back_populates="order", cascade="all, delete-orphan", order_by="OrderStatusEvent.created_at")

class OrderItemStatus(str, Enum):
    FULFILLED = "fulfilled"
    RETURNED = "returned"


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    product_variant_id = Column(String, ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    price = Column(Float, nullable=False)
    sku = Column(String(255), unique=True, nullable=True)
    status = Column(String(20), default="fulfilled", nullable=False)  # fulfilled | returned

    order = relationship("Order", back_populates="items")
    product_variant = relationship("ProductVariant")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=True)  # Legacy; nullable for migration
    checkout_id = Column(String, ForeignKey("checkouts.id", ondelete="CASCADE"), nullable=True)  # Ozon-style
    amount = Column(Float, nullable=False)
    currency = Column(String(10), nullable=False)
    status = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    order = relationship("Order", foreign_keys=[order_id])
    checkout = relationship("Checkout", back_populates="payment") 

class ExclusiveAccessEmail(Base):
    __tablename__ = "exclusive_access_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class OrderStatusEvent(Base):
    """Audit log: one row per status transition on an Order."""
    __tablename__ = "order_status_events"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status = Column(String(30), nullable=True)   # Null for first event (order creation)
    to_status = Column(String(30), nullable=False)
    actor_type = Column(String(20), nullable=False)   # "system" | "user" | "brand" | "admin"
    actor_id = Column(String, nullable=True)          # UUID/int of the actor; null for "system"
    note = Column(String(500), nullable=True)         # Optional human-readable reason
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    order = relationship("Order", back_populates="status_events")


class Notification(Base):
    """In-app notification for brands (and future: users)."""
    __tablename__ = "notifications"
    __table_args__ = {"extend_existing": True}

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    recipient_type = Column(String(20), nullable=False)  # "brand" or "user"
    recipient_id = Column(String, nullable=False, index=True)  # brand.id (int as str) or user.id
    type = Column(String(50), nullable=False)  # "new_order", "return_logged", "admin_custom"
    message = Column(String(500), nullable=False)
    order_id = Column(String, nullable=True)  # FK-like reference (not a real FK; order IDs are strings)
    is_read = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)  # now + 7 days at creation
    created_at = Column(DateTime, default=datetime.utcnow)