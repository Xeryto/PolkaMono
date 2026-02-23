import json
import random
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import List, Literal, Optional

import payment_service
import schemas
from auth_service import auth_service

# Import our modules
from config import settings
from database import get_db, init_db
from fastapi import Depends, FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from mail_service import mail_service
from models import (
    AuthAccount,
    Brand,
    Category,
    Checkout,
    ExclusiveAccessEmail,
    FriendRequest,
    FriendRequestStatus,
    Friendship,
    Gender,
    OAuthAccount,
    Order,
    OrderItem,
    OrderStatus,
    PrivacyOption,
    Product,
    ProductColorVariant,
    ProductStyle,
    ProductVariant,
    Style,
    User,
    UserBrand,
    UserLikedProduct,
    UserPreferences,
    UserProfile,
    UserShippingInfo,
    UserStyle,
    UserSwipe,
)
from oauth_service import oauth_service
from pydantic import BaseModel, ValidationError, validator
from schemas import UserCreate
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from sqlalchemy import func, or_, text
from sqlalchemy.orm import Session, joinedload
from storage_service import generate_key, generate_presigned_upload_url
from storage_service import is_configured as s3_configured
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Constants for image upload validation
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
CONTENT_TYPE_TO_EXTENSION = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


# Size ordering utility
def get_size_order(size: str) -> int:
    """Get the order index for size sorting (XS to XL)"""
    size_order = {"XS": 1, "S": 2, "M": 3, "L": 4, "XL": 5, "One Size": 6}
    return size_order.get(size, 999)  # Unknown sizes go to the end


def sort_variants_by_size(variants):
    """Sort variants by size order (XS to XL)"""
    return sorted(variants, key=lambda v: get_size_order(v.size))


def validate_image_content_type(content_type: str) -> None:
    """Validate that content_type is an allowed image MIME type.

    Raises HTTPException with 400 status if validation fails.
    """
    normalized_content_type = (content_type or "").lower()
    if normalized_content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        allowed_types = ", ".join(sorted(ALLOWED_IMAGE_CONTENT_TYPES))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid content type. Allowed types: {allowed_types}.",
        )


def determine_file_extension(content_type: str, filename: Optional[str] = None) -> str:
    """Determine appropriate file extension from content_type or filename.

    Returns extension with leading dot (e.g., '.jpg', '.png').
    If filename is provided, validates that its extension is allowed.
    Only the extension part is extracted from filename (no path components).

    This function should be called after validate_image_content_type() to ensure
    content_type is valid. The .jpg default should be unreachable in normal flow.
    """
    if filename and "." in filename:
        # Extract only the extension part (everything after the last dot)
        # This is safe from path traversal as we only use the extension, not the full path
        ext = "." + filename.rsplit(".", 1)[-1].lower()
        # Validate that the filename extension is allowed
        if ext in ALLOWED_IMAGE_EXTENSIONS:
            return ext
        # If extension is not allowed, fall through to use content_type

    normalized_content_type = (content_type or "").lower()
    # Should be unreachable with invalid content_type after validate_image_content_type()
    return CONTENT_TYPE_TO_EXTENSION.get(normalized_content_type, ".jpg")


def product_to_schema(product, is_liked=None):
    """Build schemas.Product from Product model with color_variants."""
    return schemas.Product(
        id=product.id,
        name=product.name,
        description=product.description,
        price=product.price,
        brand_id=product.brand_id,
        category_id=product.category_id,
        styles=[ps.style_id for ps in product.styles],
        color_variants=[
            schemas.ProductColorVariantSchema(
                id=cv.id,
                color_name=cv.color_name,
                color_hex=cv.color_hex,
                images=cv.images or [],
                variants=[
                    schemas.ProductVariantSchema(
                        id=v.id, size=v.size, stock_quantity=v.stock_quantity
                    )
                    for v in sort_variants_by_size(cv.variants)
                ],
            )
            for cv in product.color_variants
        ],
        material=product.material,
        article_number=product.article_number,
        brand_name=product.brand.name,
        brand_return_policy=product.brand.return_policy,
        is_liked=is_liked,
        general_images=product.general_images or [],
    )


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="PolkaAPI - Authentication Backend",
    description="A modern, fast, and secure authentication API with OAuth support for mobile and web applications",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware for React Native app
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# APScheduler: background job for order expiry
scheduler = BackgroundScheduler()


def _expire_orders_job():
    """Background job: expire CREATED orders past their expires_at."""
    db = next(get_db())
    try:
        count = payment_service.expire_pending_orders(db)
        if count:
            print(f"[scheduler] expired {count} order(s)")
    except Exception as e:
        print(f"[scheduler] expire_pending_orders error: {e}")
    finally:
        db.close()


scheduler.add_job(_expire_orders_job, IntervalTrigger(hours=1), id="expire_orders", replace_existing=True)
scheduler.start()


# Security
security = HTTPBearer()

# Pydantic Models


class UserLogin(BaseModel):
    identifier: str  # Can be either email or username
    password: str

    @validator("identifier")
    def validate_identifier(cls, v):
        if not v or not v.strip():
            raise ValueError("Identifier cannot be empty")
        return v.strip()

    def is_email(self) -> bool:
        """Check if the identifier is an email address"""
        email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        return bool(re.match(email_pattern, self.identifier))

    def is_username(self) -> bool:
        """Check if the identifier is a username"""
        # Username pattern: alphanumeric, underscores, hyphens, #, $, !
        username_pattern = r"^[a-zA-Z0-9_\-#$!]+$"
        return bool(re.match(username_pattern, self.identifier)) and not self.is_email()


class OAuthLogin(BaseModel):
    provider: str  # google, facebook, github, apple
    token: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


class UserProfileUpdate(BaseModel):
    gender: Optional[Gender] = None
    selected_size: Optional[str] = None


class BrandResponse(BaseModel):
    id: int
    name: str
    slug: str
    logo: Optional[str] = None
    description: Optional[str] = None
    shipping_price: Optional[float] = None
    min_free_shipping: Optional[int] = None


class CategoryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None


class UserBrandsUpdate(BaseModel):
    brand_ids: List[int]


class UserStylesUpdate(BaseModel):
    style_ids: List[str]


# Friend System Models
class FriendRequestCreate(BaseModel):
    recipient_identifier: str  # username or email


class FriendRequestResponse(BaseModel):
    id: str
    recipient: dict  # { "id": "user_id", "username": "recipient_username" }
    status: str


class ReceivedFriendRequestResponse(BaseModel):
    id: str
    sender: dict  # { "id": "user_id", "username": "sender_username" }
    status: str


class FriendResponse(BaseModel):
    id: str
    username: str
    avatar_url: Optional[str] = None


class UserSearchResponse(BaseModel):
    id: str
    username: str
    email: str
    avatar_url: Optional[str] = None
    friend_status: Optional[str] = (
        None  # 'friend', 'request_received', 'request_sent', 'not_friend'
    )


class PublicUserProfileResponse(BaseModel):
    id: str
    username: str
    gender: Optional[Gender] = None
    avatar_url: Optional[str] = None


class MessageResponse(BaseModel):
    message: str


class ProductVariantSchema(BaseModel):
    size: str
    stock_quantity: int


class ProductResponse(BaseModel):
    id: str
    name: str
    price: str
    image_url: Optional[str] = None
    variants: List[ProductVariantSchema] = []
    is_liked: Optional[bool] = None  # Only for /for_user endpoint


class ToggleFavoriteRequest(BaseModel):
    product_id: str
    action: Literal["like", "unlike"]


class PaymentCreateResponse(BaseModel):
    confirmation_url: str


class PaymentStatusResponse(BaseModel):
    status: str


class AuthResponse(BaseModel):
    token: str
    expires_at: datetime
    user: schemas.UserProfileResponse


class OAuthProviderResponse(BaseModel):
    provider: str
    client_id: str
    redirect_url: str
    scope: str


@app.get("/api/v1/payments/status", response_model=PaymentStatusResponse)
async def get_payment_status(payment_id: str, db: Session = Depends(get_db)):
    """Get the status of a payment by its ID and update it from YooKassa"""
    order = db.query(Order).filter(Order.id == payment_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
        )

    # Fetch real-time status from YooKassa
    yookassa_status = payment_service.get_yookassa_payment_status(str(order.payment_id))  # type: ignore
    if yookassa_status:
        # Update local order status if different
        if order.status.value.lower() != yookassa_status.lower():
            print(
                f"Updating order {order.id} status from {order.status.value} to {yookassa_status} based on YooKassa."
            )
            order.status = OrderStatus(
                yookassa_status.upper()
            )  # Assuming YooKassa status matches OrderStatus enum
            db.commit()
            db.refresh(order)
    else:
        print(f"Could not fetch real-time status for order {order.id} from YooKassa.")

    return PaymentStatusResponse(status=order.status.value)


# Dependency to get current user (can be User or Brand)
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> any:  # Return type can be User or Brand
    """Get current user (User or Brand) from JWT token"""
    payload = auth_service.verify_token_payload(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен. Пожалуйста, войдите в систему заново.",
        )

    user_id = payload.get("sub")
    is_brand = payload.get("is_brand", False)

    if is_brand:
        entity = db.query(Brand).filter(Brand.id == user_id).first()
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Бренд не найден. Проверьте правильность учетных данных.",
            )
    else:
        entity = auth_service.get_user_by_id(db, user_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден. Проверьте правильность учетных данных.",
            )

    return entity


def get_current_brand_user(
    current_user: any = Depends(get_current_user),  # current_user can be User or Brand
    db: Session = Depends(get_db),
) -> Brand:  # Ensure it returns a Brand
    """Get current brand user from JWT token"""
    # Check if the entity is indeed a Brand instance
    if not isinstance(current_user, Brand):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Not a brand account"
        )
    return current_user


@app.get("/api/v1/brands/profile", response_model=schemas.BrandResponse)
async def get_brand_profile(
    current_brand_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Get the authenticated brand user's profile"""
    brand = db.query(Brand).filter(Brand.id == int(str(current_brand_user.id))).first()  # type: ignore
    if not brand:
        raise HTTPException(
            status_code=404, detail="Бренд не найден. Проверьте правильность данных."
        )

    return schemas.BrandResponse(
        id=int(brand.id),  # type: ignore
        name=str(brand.name),  # type: ignore
        email=brand.auth_account.email,
        slug=str(brand.slug),  # type: ignore
        logo=str(brand.logo) if brand.logo else None,  # type: ignore
        description=str(brand.description) if brand.description else None,  # type: ignore
        return_policy=str(brand.return_policy) if brand.return_policy else None,  # type: ignore
        min_free_shipping=int(brand.min_free_shipping)
        if brand.min_free_shipping
        else None,  # type: ignore
        shipping_price=float(brand.shipping_price) if brand.shipping_price else None,  # type: ignore
        shipping_provider=str(brand.shipping_provider)
        if brand.shipping_provider
        else None,  # type: ignore
        amount_withdrawn=float(brand.amount_withdrawn),  # type: ignore
        inn=str(brand.inn) if brand.inn else None,  # type: ignore
        registration_address=str(brand.registration_address)
        if brand.registration_address
        else None,  # type: ignore
        payout_account=str(brand.payout_account) if brand.payout_account else None,  # type: ignore
        payout_account_locked=brand.payout_account_locked,
        created_at=brand.created_at,  # type: ignore
        updated_at=brand.updated_at,  # type: ignore
    )


class BrandStatsResponse(BaseModel):
    total_sold: float
    total_withdrawn: float
    current_balance: float


class UserStatsResponse(BaseModel):
    items_purchased: int
    items_swiped: int
    total_orders: int
    account_age_days: int


class SwipeTrackingRequest(BaseModel):
    product_id: str


@app.get("/api/v1/brands/stats", response_model=BrandStatsResponse)
async def get_brand_stats(
    current_brand_user: Brand = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Get statistics for the authenticated brand user"""

    # 1. Get total amount sold
    orders_with_brand_products = (
        db.query(Order)
        .join(OrderItem)
        .join(ProductVariant, OrderItem.product_variant_id == ProductVariant.id)
        .join(
            ProductColorVariant,
            ProductVariant.product_color_variant_id == ProductColorVariant.id,
        )
        .join(Product, ProductColorVariant.product_id == Product.id)
        .filter(Product.brand_id == current_brand_user.id)
        .distinct()
        .all()
    )

    total_sold = 0.0
    for order in orders_with_brand_products:
        for item in order.items:
            # Ensure the product variant belongs to a product of the current brand
            if item.product_variant.product.brand_id == current_brand_user.id:
                total_sold += item.price

    # 2. Get total withdrawn
    total_withdrawn = current_brand_user.amount_withdrawn

    # 3. Calculate current balance
    current_balance = total_sold - total_withdrawn

    return BrandStatsResponse(
        total_sold=total_sold,
        total_withdrawn=total_withdrawn,
        current_balance=current_balance,
    )


@app.get("/api/v1/user/stats", response_model=UserStatsResponse)
async def get_user_stats(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get statistics for the authenticated user"""

    # Items purchased: from PAID/SHIPPED orders (via Order.user_id or Checkout)
    items_purchased = (
        db.query(func.count(OrderItem.id))
        .join(Order)
        .filter(
            Order.user_id == str(current_user.id),
            Order.status.in_([OrderStatus.PAID, OrderStatus.SHIPPED]),
        )
        .scalar()
        or 0
    )

    items_swiped = current_user.items_swiped or 0

    # Total orders: Checkouts (purchases) for user, fallback to Order count for legacy
    total_orders = (
        db.query(func.count(Checkout.id))
        .filter(Checkout.user_id == str(current_user.id))
        .scalar()
        or 0
    )
    if total_orders == 0:
        total_orders = (
            db.query(func.count(Order.id))
            .filter(Order.user_id == str(current_user.id))
            .scalar()
            or 0
        )

    # Calculate account age in days
    account_age_days = (datetime.utcnow() - current_user.created_at).days

    return UserStatsResponse(
        items_purchased=items_purchased,
        items_swiped=items_swiped,
        total_orders=total_orders,
        account_age_days=account_age_days,
    )


@app.post("/api/v1/user/swipe", response_model=MessageResponse)
async def track_user_swipe(
    swipe_data: SwipeTrackingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Track user swipe on a product"""

    # Verify product exists
    product = db.query(Product).filter(Product.id == swipe_data.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    # Create swipe record and increment counter (Option 2)
    user_swipe = UserSwipe(
        user_id=current_user.id,
        product_id=swipe_data.product_id,
    )
    db.add(user_swipe)
    current_user.items_swiped = (current_user.items_swiped or 0) + 1
    db.commit()

    return {"message": "Swipe tracked successfully"}


@app.put("/api/v1/brands/profile", response_model=schemas.BrandResponse)
async def update_brand_profile(
    brand_data: schemas.BrandUpdate,
    current_brand_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Update the authenticated brand user's profile"""
    brand = db.query(Brand).filter(Brand.id == int(str(current_brand_user.id))).first()  # type: ignore
    if not brand:
        raise HTTPException(
            status_code=404, detail="Бренд не найден. Проверьте правильность данных."
        )

    # Update fields
    if brand_data.name is not None:
        brand.name = brand_data.name
    if brand_data.email is not None:
        # Check if new email is already taken by another brand
        if (
            db.query(AuthAccount)
            .filter(
                AuthAccount.email == brand_data.email,
                AuthAccount.id != brand.auth_account_id,
            )
            .first()
        ):
            raise HTTPException(
                status_code=400, detail="Email already registered to another brand"
            )
        brand.auth_account.email = brand_data.email
    if brand_data.password is not None:
        brand.auth_account.password_hash = auth_service.hash_password(
            brand_data.password
        )
    if brand_data.slug is not None:
        brand.slug = brand_data.slug
    if brand_data.logo is not None:
        brand.logo = brand_data.logo
    if brand_data.description is not None:
        brand.description = brand_data.description  # type: ignore
    if brand_data.return_policy is not None:
        brand.return_policy = brand_data.return_policy  # type: ignore
    if brand_data.min_free_shipping is not None:
        brand.min_free_shipping = brand_data.min_free_shipping  # type: ignore
    if brand_data.shipping_price is not None:
        brand.shipping_price = brand_data.shipping_price  # type: ignore
    if brand_data.shipping_provider is not None:
        brand.shipping_provider = brand_data.shipping_provider  # type: ignore
    requisites_updated = False
    if brand_data.inn is not None:
        brand.inn = brand_data.inn
        requisites_updated = True
    if brand_data.registration_address is not None:
        brand.registration_address = brand_data.registration_address  # type: ignore
        requisites_updated = True
    if brand_data.payout_account is not None:
        if brand.payout_account_locked:  # type: ignore
            raise HTTPException(
                status_code=400,
                detail="Счёт для выплат заблокирован. Обратитесь в поддержку для изменения.",
            )
        brand.payout_account = brand_data.payout_account  # type: ignore
        requisites_updated = True
    if requisites_updated:
        brand.payout_account_locked = 1  # Lock on every update of requisites
    elif brand_data.payout_account_locked is not None:
        brand.payout_account_locked = 1 if brand_data.payout_account_locked else 0

    brand.updated_at = datetime.utcnow()  # type: ignore
    db.commit()
    db.refresh(brand)

    return schemas.BrandResponse(
        id=int(brand.id),  # type: ignore
        name=str(brand.name),  # type: ignore
        email=brand.auth_account.email,
        slug=str(brand.slug),  # type: ignore
        logo=str(brand.logo) if brand.logo else None,  # type: ignore
        description=str(brand.description) if brand.description else None,  # type: ignore
        return_policy=str(brand.return_policy) if brand.return_policy else None,  # type: ignore
        min_free_shipping=int(brand.min_free_shipping)
        if brand.min_free_shipping
        else None,  # type: ignore
        shipping_price=float(brand.shipping_price) if brand.shipping_price else None,  # type: ignore
        shipping_provider=str(brand.shipping_provider)
        if brand.shipping_provider
        else None,  # type: ignore
        amount_withdrawn=float(brand.amount_withdrawn),  # type: ignore
        inn=str(brand.inn) if brand.inn else None,  # type: ignore
        registration_address=str(brand.registration_address)
        if brand.registration_address
        else None,  # type: ignore
        payout_account=str(brand.payout_account) if brand.payout_account else None,  # type: ignore
        payout_account_locked=brand.payout_account_locked,
        created_at=brand.created_at,  # type: ignore
        updated_at=brand.updated_at,  # type: ignore
    )


# API Endpoints
@app.get("/api/v1/auth/check-username/{username}")
async def check_username_availability(username: str, db: Session = Depends(get_db)):
    """Check if username is available"""
    existing_user = auth_service.get_user_by_username(db, username)
    return {"available": existing_user is None}


@app.get("/api/v1/auth/check-email/{email}")
async def check_email_availability(email: str, db: Session = Depends(get_db)):
    """Check if email is available"""
    existing_user = auth_service.get_user_by_email(db, email)
    return {"available": existing_user is None}


@app.post(
    "/api/v1/auth/register",
    response_model=AuthResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    if auth_service.get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует. Используйте другой email или войдите в систему.",
        )

    if auth_service.get_user_by_username(db, user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя уже занято. Выберите другое имя пользователя.",
        )

    # Create new user
    password_hash = auth_service.hash_password(user_data.password)
    user = auth_service.create_user(
        db=db,
        username=user_data.username,
        email=user_data.email,
        password_hash=password_hash,
        gender=user_data.gender,
        selected_size=user_data.selected_size,
        avatar_url=user_data.avatar_url,
    )

    # Send verification email
    code = auth_service.create_verification_code(db, user)
    mail_service.send_email(
        to_email=user.auth_account.email,
        subject="Verify your email address",
        html_content=f"Your email verification code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code in the app to verify your email.",
    )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )

    # Get avatar_url from profile if it exists
    avatar_url = user.profile.avatar_url if user.profile else None
    return AuthResponse(
        token=access_token,
        expires_at=datetime.utcnow() + access_token_expires,
        user=schemas.UserProfileResponse(
            id=user.id,
            username=user.username,
            email=user.auth_account.email,
            avatar_url=avatar_url,
            is_active=user.is_active,
            is_email_verified=user.auth_account.is_email_verified,
            created_at=user.created_at,
            updated_at=user.updated_at,
        ),
    )


@app.post("/api/v1/auth/login", response_model=AuthResponse)
async def login(user_data: UserLogin, db: Session = Depends(get_db)):
    """Login user with email or username and password"""

    # Determine if the identifier is an email or username
    if user_data.is_email():
        user = auth_service.get_user_by_email(db, user_data.identifier)
    elif user_data.is_username():
        user = auth_service.get_user_by_username(db, user_data.identifier)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный формат идентификатора. Пожалуйста, введите действительный email или имя пользователя.",
        )

    if not user or not user.auth_account.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные. Проверьте правильность email/имени пользователя и пароля.",
        )

    if not auth_service.verify_password(
        user_data.password, user.auth_account.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль. Проверьте правильность введенного пароля.",
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": user.id}, expires_delta=access_token_expires
    )

    # Get avatar_url from profile if it exists
    avatar_url = user.profile.avatar_url if user.profile else None
    return AuthResponse(
        token=access_token,
        expires_at=datetime.utcnow() + access_token_expires,
        user=schemas.UserProfileResponse(
            id=user.id,
            username=user.username,
            email=user.auth_account.email,
            avatar_url=avatar_url,
            is_active=user.is_active,
            is_email_verified=user.auth_account.is_email_verified,
            created_at=user.created_at,
            updated_at=user.updated_at,
        ),
    )


@app.post("/api/v1/auth/oauth/login", response_model=AuthResponse)
async def oauth_login(oauth_data: OAuthLogin, db: Session = Depends(get_db)):
    """Login with OAuth provider"""
    result = await auth_service.handle_oauth_login(
        db, oauth_data.provider, oauth_data.token
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth token or provider not supported",
        )

    return AuthResponse(
        token=result["token"],
        expires_at=result["expires_at"],
        user=schemas.UserProfileResponse(**result["user"]),
    )


@app.post(
    "/api/v1/brands/auth/login", response_model=AuthResponse
)  # Re-use AuthResponse for now, will adjust user field later
async def brand_login(brand_data: schemas.BrandLogin, db: Session = Depends(get_db)):
    """Login brand user with email and password"""
    brand = (
        db.query(Brand)
        .join(AuthAccount)
        .filter(AuthAccount.email == brand_data.email)
        .first()
    )
    if not brand or not auth_service.verify_password(
        brand_data.password, brand.auth_account.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные бренда. Проверьте правильность email и пароля.",
        )

    # Create access token for the brand
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": str(brand.id), "is_brand": True},
        expires_delta=access_token_expires,
    )

    # For now, return a simplified UserResponse for the brand
    # In a real app, you'd have a dedicated BrandAuthResponse or similar
    return AuthResponse(
        token=access_token,
        expires_at=datetime.utcnow() + access_token_expires,
        user=schemas.UserProfileResponse(  # Re-using UserProfileResponse, but it's a Brand
            id=str(brand.id),  # Convert int ID to string for UserProfileResponse
            username=brand.name,  # Use brand name as username
            email=brand.auth_account.email,
            is_active=True,  # Brands are always active for login
            is_email_verified=True,  # Assuming brand emails are verified
            is_brand=True,
            created_at=brand.created_at,
            updated_at=brand.updated_at,
            # Brand specific fields
            return_policy=brand.return_policy,
            min_free_shipping=brand.min_free_shipping,
            shipping_price=brand.shipping_price,
            shipping_provider=brand.shipping_provider,
        ),
    )


@app.post("/api/v1/brands/auth/forgot-password")
@limiter.limit("5/minute")
async def brand_forgot_password(
    request: Request,
    forgot_password_request: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    """Send password reset code to brand email"""
    # Determine if the identifier is an email or brand name
    identifier = forgot_password_request.identifier.strip()

    # Check if it's an email
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    is_email = bool(re.match(email_pattern, identifier))

    if is_email:
        brand = (
            db.query(Brand)
            .join(AuthAccount)
            .filter(AuthAccount.email == identifier)
            .first()
        )
    else:
        brand = db.query(Brand).filter(Brand.name == identifier).first()
    if not brand:
        return {
            "message": "If a brand account with that email or name exists, a password reset code has been sent."
        }

    # Create verification code for brand password reset
    code = auth_service.create_verification_code(db, brand)
    mail_service.send_email(
        to_email=brand.auth_account.email,
        subject="Brand Password Reset Code",
        html_content=f"Your brand password reset code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code to reset your brand password.",
    )

    return {
        "message": "If a brand account with that email or name exists, a password reset code has been sent."
    }


@app.post("/api/v1/brands/auth/validate-password-reset-code")
async def brand_validate_password_reset_code(
    validation_request: schemas.ValidatePasswordResetCodeRequest,
    db: Session = Depends(get_db),
):
    """Validate password reset code for brand"""
    identifier = validation_request.identifier.strip()

    # Check if it's an email
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    is_email = bool(re.match(email_pattern, identifier))

    if is_email:
        brand = (
            db.query(Brand)
            .join(AuthAccount)
            .filter(AuthAccount.email == identifier)
            .first()
        )
    else:
        brand = db.query(Brand).filter(Brand.name == identifier).first()
    if not brand:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")
    acc = brand.auth_account
    if acc.email_verification_code != validation_request.code:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")
    if acc.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
    return {"message": "Code is valid"}


@app.post("/api/v1/brands/auth/reset-password-with-code")
async def brand_reset_password_with_code(
    reset_password_request: schemas.ResetPasswordWithCodeRequest,
    db: Session = Depends(get_db),
):
    """Reset brand password using verification code"""
    identifier = reset_password_request.identifier.strip()

    # Check if it's an email
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    is_email = bool(re.match(email_pattern, identifier))

    if is_email:
        brand = (
            db.query(Brand)
            .join(AuthAccount)
            .filter(AuthAccount.email == identifier)
            .first()
        )
    else:
        brand = db.query(Brand).filter(Brand.name == identifier).first()
    if not brand:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")
    acc = brand.auth_account
    if acc.email_verification_code != reset_password_request.code:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")
    if acc.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
    new_password_hash = auth_service.hash_password(reset_password_request.new_password)
    if acc.password_hash and auth_service.verify_password(
        reset_password_request.new_password, acc.password_hash
    ):
        raise HTTPException(
            status_code=400, detail="You cannot reuse your current password"
        )
    if acc.password_history:
        for historical_hash in acc.password_history:
            if auth_service.verify_password(
                reset_password_request.new_password, historical_hash
            ):
                raise HTTPException(
                    status_code=400, detail="You cannot reuse a previous password"
                )
    if not acc.password_history:
        acc.password_history = []
    if acc.password_hash:
        acc.password_history.append(acc.password_hash)
    if len(acc.password_history) > 5:
        acc.password_history = acc.password_history[-5:]
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(acc, "password_history")
    acc.password_hash = new_password_hash
    acc.email_verification_code = None
    acc.email_verification_code_expires_at = None
    db.commit()

    return {"message": "Brand password has been reset successfully."}


@app.get("/api/v1/auth/oauth/providers", response_model=List[OAuthProviderResponse])
async def get_oauth_providers():
    """Get available OAuth providers"""
    providers = []

    if settings.GOOGLE_CLIENT_ID:
        providers.append(
            OAuthProviderResponse(
                provider="google",
                client_id=settings.GOOGLE_CLIENT_ID,
                redirect_url=f"{settings.OAUTH_REDIRECT_URL}/google",
                scope="openid email profile",
            )
        )

    if settings.FACEBOOK_CLIENT_ID:
        providers.append(
            OAuthProviderResponse(
                provider="facebook",
                client_id=settings.FACEBOOK_CLIENT_ID,
                redirect_url=f"{settings.OAUTH_REDIRECT_URL}/facebook",
                scope="email public_profile",
            )
        )

    if settings.GITHUB_CLIENT_ID:
        providers.append(
            OAuthProviderResponse(
                provider="github",
                client_id=settings.GITHUB_CLIENT_ID,
                redirect_url=f"{settings.OAUTH_REDIRECT_URL}/github",
                scope="read:user user:email",
            )
        )

    if settings.APPLE_CLIENT_ID:
        providers.append(
            OAuthProviderResponse(
                provider="apple",
                client_id=settings.APPLE_CLIENT_ID,
                redirect_url=f"{settings.OAUTH_REDIRECT_URL}/apple",
                scope="name email",
            )
        )

    return providers


@app.get("/api/v1/auth/oauth/{provider}/authorize")
async def oauth_authorize(provider: str, request: Request):
    """Redirect to OAuth provider authorization URL"""
    oauth_client = oauth_service.get_oauth_client(provider)

    if not oauth_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider not configured",
        )

    redirect_uri = f"{settings.OAUTH_REDIRECT_URL}/{provider}"
    authorization_url, state = oauth_client.create_authorization_url(
        redirect_uri=redirect_uri
    )

    return RedirectResponse(url=authorization_url)


@app.get("/api/v1/auth/oauth/callback/{provider}")
async def oauth_callback(
    provider: str, code: str, state: str, db: Session = Depends(get_db)
):
    """Handle OAuth callback"""
    oauth_client = oauth_service.get_oauth_client(provider)

    if not oauth_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider not configured",
        )

    try:
        redirect_uri = f"{settings.OAUTH_REDIRECT_URL}/{provider}"
        token = oauth_client.fetch_token(
            token_url=oauth_client.token_endpoint,
            authorization_response=f"?code={code}&state={state}",
            redirect_uri=redirect_uri,
        )

        access_token = token.get("access_token")
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get access token",
            )

        result = await auth_service.handle_oauth_login(db, provider, access_token)

        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to process OAuth login",
            )

        # In a real application, you might want to redirect to a frontend URL
        # with the token as a query parameter or use a more sophisticated approach
        return {
            "token": result["token"],
            "expires_at": result["expires_at"],
            "user": result["user"],
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth callback failed: {str(e)}",
        )


@app.post("/api/v1/auth/request-verification")
@limiter.limit("5/minute")
async def request_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.auth_account.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    code = auth_service.create_verification_code(db, current_user)
    mail_service.send_email(
        to_email=current_user.auth_account.email,
        subject="Verify your email address",
        html_content=f"Your email verification code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code in the app to verify your email.",
    )
    return {"message": "Verification email sent"}


@app.post("/api/v1/auth/verify-email")
async def verify_email(
    verification_data: schemas.EmailVerificationRequest, db: Session = Depends(get_db)
):
    user = auth_service.get_user_by_email(db, verification_data.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or code")

    acc = user.auth_account
    if acc.email_verification_code != verification_data.code:
        raise HTTPException(status_code=400, detail="Invalid email or code")
    if acc.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
    acc.is_email_verified = True
    acc.email_verification_code = None
    acc.email_verification_code_expires_at = None
    db.commit()

    return {"message": "Email verified successfully"}


@app.post("/api/v1/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(
    request: Request,
    forgot_password_request: schemas.ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    # Determine if the identifier is an email or username
    identifier = forgot_password_request.identifier.strip()

    # Check if it's an email
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    is_email = bool(re.match(email_pattern, identifier))

    if is_email:
        user = auth_service.get_user_by_email(db, identifier)
    else:
        # Treat as username
        user = auth_service.get_user_by_username(db, identifier)

    if not user:
        # Still return a success message to prevent enumeration
        return {
            "message": "If an account with that username or email exists, a password reset code has been sent."
        }

    # Create verification code instead of token for code-based reset
    code = auth_service.create_verification_code(db, user)
    mail_service.send_email(
        to_email=user.auth_account.email,
        subject="Password Reset Code",
        html_content=f"Your password reset code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code in the app to reset your password.",
    )

    return {
        "message": "If an account with that username or email exists, a password reset code has been sent."
    }


@app.post("/api/v1/auth/reset-password")
async def reset_password(
    reset_password_request: schemas.ResetPasswordRequest, db: Session = Depends(get_db)
):
    user = (
        db.query(User)
        .join(AuthAccount)
        .filter(AuthAccount.password_reset_token == reset_password_request.token)
        .first()
    )
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")
    acc = user.auth_account
    if acc.password_reset_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token has expired")
    new_password_hash = auth_service.hash_password(reset_password_request.new_password)
    if acc.password_hash and auth_service.verify_password(
        reset_password_request.new_password, acc.password_hash
    ):
        raise HTTPException(
            status_code=400, detail="You cannot reuse your current password"
        )
    if acc.password_history:
        for historical_hash in acc.password_history:
            if auth_service.verify_password(
                reset_password_request.new_password, historical_hash
            ):
                raise HTTPException(
                    status_code=400, detail="You cannot reuse a previous password"
                )
    if not acc.password_history:
        acc.password_history = []
    if acc.password_hash:
        acc.password_history.append(acc.password_hash)
    if len(acc.password_history) > 5:
        acc.password_history = acc.password_history[-5:]
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(acc, "password_history")
    acc.password_hash = new_password_hash
    acc.password_reset_token = None
    acc.password_reset_expires = None
    db.commit()
    return {"message": "Password has been reset successfully."}


@app.post("/api/v1/auth/validate-password-reset-code")
async def validate_password_reset_code(
    validation_request: schemas.ValidatePasswordResetCodeRequest,
    db: Session = Depends(get_db),
):
    # Determine if the identifier is an email or username
    identifier = validation_request.identifier.strip()

    # Check if it's an email
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    is_email = bool(re.match(email_pattern, identifier))

    if is_email:
        user = auth_service.get_user_by_email(db, identifier)
    else:
        # Treat as username
        user = auth_service.get_user_by_username(db, identifier)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")

    acc = user.auth_account
    if acc.email_verification_code != validation_request.code:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")
    if acc.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
    return {"message": "Code is valid"}


@app.post("/api/v1/auth/reset-password-with-code")
async def reset_password_with_code(
    reset_password_request: schemas.ResetPasswordWithCodeRequest,
    db: Session = Depends(get_db),
):
    # Determine if the identifier is an email or username
    identifier = reset_password_request.identifier.strip()

    # Check if it's an email
    email_pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    is_email = bool(re.match(email_pattern, identifier))

    if is_email:
        user = auth_service.get_user_by_email(db, identifier)
    else:
        # Treat as username
        user = auth_service.get_user_by_username(db, identifier)

    if not user:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")

    acc = user.auth_account
    if acc.email_verification_code != reset_password_request.code:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")
    if acc.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")
    new_password_hash = auth_service.hash_password(reset_password_request.new_password)
    if acc.password_hash and auth_service.verify_password(
        reset_password_request.new_password, acc.password_hash
    ):
        raise HTTPException(
            status_code=400, detail="You cannot reuse your current password"
        )
    if acc.password_history:
        for historical_hash in acc.password_history:
            if auth_service.verify_password(
                reset_password_request.new_password, historical_hash
            ):
                raise HTTPException(
                    status_code=400, detail="You cannot reuse a previous password"
                )
    if not acc.password_history:
        acc.password_history = []
    if acc.password_hash:
        acc.password_history.append(acc.password_hash)
    if len(acc.password_history) > 5:
        acc.password_history = acc.password_history[-5:]
    from sqlalchemy.orm.attributes import flag_modified

    flag_modified(acc, "password_history")
    acc.password_hash = new_password_hash
    acc.email_verification_code = None
    acc.email_verification_code_expires_at = None
    db.commit()
    return {"message": "Password has been reset successfully."}


@app.post("/api/v1/auth/logout")
async def logout():
    """Logout user (JWT tokens are stateless)"""
    return {"message": "Successfully logged out"}


@app.post("/api/v1/exclusive-access-signup", status_code=status.HTTP_201_CREATED)
async def exclusive_access_signup(
    signup_data: schemas.ExclusiveAccessSignupRequest, db: Session = Depends(get_db)
):
    """Store email for exclusive access signup"""
    existing_email = (
        db.query(ExclusiveAccessEmail)
        .filter(ExclusiveAccessEmail.email == signup_data.email)
        .first()
    )
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already signed up for exclusive access",
        )

    new_signup = ExclusiveAccessEmail(email=signup_data.email)
    db.add(new_signup)
    db.commit()
    return {"message": "Successfully signed up for exclusive access!"}


@app.get("/api/v1/user/profile", response_model=schemas.UserProfileResponse)
async def get_user_profile(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get current user's complete profile (users only)"""
    # Ensure user_id is treated as a string for database comparison
    user_id = str(current_user.id)

    # Get favorite brands and styles
    favorite_brands = (
        db.query(Brand).join(UserBrand).filter(UserBrand.user_id == user_id).all()
    )
    favorite_styles = (
        db.query(Style).join(UserStyle).filter(UserStyle.user_id == user_id).all()
    )

    # Get domain-specific data
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    shipping_info = (
        db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
    )
    preferences = (
        db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    )

    return schemas.UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.auth_account.email,
        is_active=current_user.is_active,
        is_email_verified=current_user.auth_account.is_email_verified,
        is_brand=False,  # Mark as regular user
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        favorite_brands=[
            schemas.UserBrandResponse(
                id=int(brand.id),  # type: ignore
                name=str(brand.name),  # type: ignore
                slug=str(brand.slug),  # type: ignore
                logo=str(brand.logo) if brand.logo else None,  # type: ignore
                description=str(brand.description) if brand.description else None,  # type: ignore
            )
            for brand in favorite_brands
        ],
        favorite_styles=[
            schemas.StyleResponse(
                id=style.id, name=style.name, description=style.description
            )
            for style in favorite_styles
        ],
        profile=schemas.ProfileResponse(
            full_name=profile.full_name,
            gender=profile.gender.value if profile.gender else None,
            selected_size=profile.selected_size,
            avatar_url=profile.avatar_url,
            avatar_url_full=profile.avatar_url_full,
            avatar_crop=profile.avatar_crop,
            avatar_transform=profile.avatar_transform,
        )
        if profile
        else None,
        shipping_info=schemas.ShippingInfoResponse(
            delivery_email=shipping_info.delivery_email,
            phone=shipping_info.phone,
            street=shipping_info.street,
            house_number=shipping_info.house_number,
            apartment_number=shipping_info.apartment_number,
            city=shipping_info.city,
            postal_code=shipping_info.postal_code,
        )
        if shipping_info
        else None,
        preferences=schemas.PreferencesResponse(
            size_privacy=preferences.size_privacy.value
            if preferences.size_privacy
            else None,
            recommendations_privacy=preferences.recommendations_privacy.value
            if preferences.recommendations_privacy
            else None,
            likes_privacy=preferences.likes_privacy.value
            if preferences.likes_privacy
            else None,
            order_notifications=preferences.order_notifications,
            marketing_notifications=preferences.marketing_notifications,
        )
        if preferences
        else None,
    )


@app.delete("/api/v1/users/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
    current_user: any = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete current user account (users only). Soft-deletes and anonymizes PII; keeps orders for legal/financial records."""
    if isinstance(current_user, Brand):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Удаление аккаунта бренда через этот endpoint недоступно.",
        )
    user = current_user
    user_id = str(user.id)
    now = datetime.utcnow()

    # Remove related data (so no PII remains in join tables)
    db.query(OAuthAccount).filter(OAuthAccount.user_id == user_id).delete()
    db.query(UserBrand).filter(UserBrand.user_id == user_id).delete()
    db.query(UserStyle).filter(UserStyle.user_id == user_id).delete()
    db.query(UserLikedProduct).filter(UserLikedProduct.user_id == user_id).delete()
    db.query(UserSwipe).filter(UserSwipe.user_id == user_id).delete()
    user.items_swiped = 0
    db.query(FriendRequest).filter(
        (FriendRequest.sender_id == user_id) | (FriendRequest.recipient_id == user_id)
    ).delete()
    db.query(Friendship).filter(
        (Friendship.user_id == user_id) | (Friendship.friend_id == user_id)
    ).delete()

    # Anonymize user (keep row for Order.user_id FK; unique email/username)
    acc = user.auth_account
    acc.email = f"deleted_{user_id}@anonymized.local"
    acc.password_hash = None
    acc.email_verification_code = None
    acc.email_verification_code_expires_at = None
    acc.password_reset_token = None
    acc.password_reset_expires = None
    acc.password_history = []
    user.username = f"deleted_{user_id}"[:50]
    user.is_active = False
    user.deleted_at = now

    # Anonymize profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if profile:
        profile.full_name = None  # type: ignore
        profile.gender = None  # type: ignore
        profile.selected_size = None  # type: ignore
        profile.avatar_url = None  # type: ignore
        profile.avatar_url_full = None  # type: ignore
        profile.avatar_crop = None  # type: ignore
        profile.avatar_transform = None  # type: ignore

    # Anonymize shipping
    shipping = (
        db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
    )
    if shipping:
        shipping.delivery_email = None
        shipping.phone = None
        shipping.street = None
        shipping.house_number = None
        shipping.apartment_number = None
        shipping.city = None
        shipping.postal_code = None

    db.commit()
    return {"message": "Аккаунт успешно удалён."}


@app.post(
    "/api/v1/brands/upload/presigned-url",
    response_model=schemas.PresignedUploadResponse,
)
async def get_product_image_presigned_url(
    body: schemas.PresignedUploadRequest,
    current_user: Brand = Depends(get_current_brand_user),
):
    """Get a presigned URL to upload a product image. Upload with PUT to upload_url, then use public_url in product general_images or color_variant.images."""
    if not s3_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload is not configured.",
        )

    # Validate that the requested content type is an allowed image MIME type
    validate_image_content_type(body.content_type)

    ext = determine_file_extension(body.content_type, body.filename)
    key = generate_key("products", ext)
    upload_url, public_url = generate_presigned_upload_url(key, body.content_type)
    return schemas.PresignedUploadResponse(
        upload_url=upload_url, public_url=public_url, key=key
    )


@app.post(
    "/api/v1/brands/products",
    response_model=schemas.Product,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    product_data: schemas.ProductCreateRequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Create a new product for the authenticated brand user"""

    # Generate unique article number for the product (Option 5: Brand + Abbreviation + Random)
    def generate_article_number(brand_name: str, product_name: str) -> str:
        """Generate article number: BRAND-ABBREV-RANDOM (e.g., NIKE-AM270-A3B7)"""
        # Brand prefix: First 4-6 uppercase letters
        brand_clean = re.sub(r"[^A-Z0-9]", "", brand_name.upper())
        brand_prefix = brand_clean[:6]

        # Remove brand name from product name if present
        product_clean = re.sub(
            r"\b" + re.escape(brand_name) + r"\b", "", product_name, flags=re.IGNORECASE
        ).strip()
        words = product_clean.split() if product_clean else product_name.split()

        # Abbreviation: First letter of each significant word (skip stop words)
        stop_words = {
            "the",
            "a",
            "an",
            "and",
            "or",
            "of",
            "in",
            "on",
            "at",
            "to",
            "for",
            "with",
        }
        significant_words = [w for w in words[:5] if w.lower() not in stop_words]

        if significant_words:
            # Separate words with numbers from words without
            words_with_numbers = []
            words_without_numbers = []

            for word in significant_words[:4]:
                if re.search(r"\d", word):
                    words_with_numbers.append(word)
                else:
                    words_without_numbers.append(word)

            abbrev_parts = []

            # Take first letter of words WITHOUT numbers (up to 3 words)
            for word in words_without_numbers[:3]:
                first_char = re.sub(r"[^A-Z]", "", word.upper())[0:1]
                if first_char:
                    abbrev_parts.append(first_char)

            # Extract numbers from words WITH numbers (preserve full number if possible)
            if words_with_numbers:
                for word in words_with_numbers[:2]:  # Check first 2 words with numbers
                    number_match = re.search(r"\d+", word)
                    if number_match:
                        number_str = number_match.group(0)[:3]  # Max 3 digits
                        abbrev_parts.append(number_str)
                        break  # Only use first number found

            product_abbrev = "".join(abbrev_parts)[:5]  # Cap at 5 characters total
        else:
            product_abbrev = re.sub(r"[^A-Z0-9]", "", product_name.upper())[:5]

        if len(product_abbrev) < 2:
            product_abbrev = re.sub(r"[^A-Z0-9]", "", product_name.upper())[:5] or "PRD"

        # Random suffix: 4 characters (excludes ambiguous: 0, O, 1, I, L)
        random_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        random_suffix = "".join(random.choices(random_chars, k=4))

        return f"{brand_prefix}-{product_abbrev}-{random_suffix}"

    # Generate unique article number (handle collisions)
    article_number = None
    max_attempts = 10
    for attempt in range(max_attempts):
        candidate_article = generate_article_number(str(current_user.name), product_data.name)  # type: ignore
        existing = (
            db.query(Product)
            .filter(Product.article_number == candidate_article)
            .first()
        )
        if not existing:
            article_number = candidate_article
            break
        # On collision, modify random suffix
        if attempt < max_attempts - 1:
            random_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
            candidate_article = candidate_article[:-4] + "".join(
                random.choices(random_chars, k=4)
            )

    if not article_number:
        # Fallback: use UUID-based (extremely unlikely to need this)
        product_id_preview = str(uuid.uuid4())[:8].upper()
        random_chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        brand_prefix = re.sub(r"[^A-Z0-9]", "", current_user.name.upper())[:6]
        article_number = f"{brand_prefix}-{product_id_preview[:4]}-{''.join(random.choices(random_chars, k=4))}"

    # Create product (no images/color; those live on color_variants)
    product = Product(
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        material=product_data.material,
        article_number=article_number,
        brand_id=current_user.id,         # always the authenticated brand
        category_id=product_data.category_id,
        general_images=product_data.general_images or [],
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Add color variants (each with its own images and size/stock variants)
    for order_index, cv_data in enumerate(product_data.color_variants):
        color_variant = ProductColorVariant(
            product_id=product.id,
            color_name=cv_data.color_name,
            color_hex=cv_data.color_hex,
            images=cv_data.images or [],
            display_order=order_index,
        )
        db.add(color_variant)
    db.commit()
    db.refresh(product)

    for cv_data in product_data.color_variants:
        color_variant = (
            db.query(ProductColorVariant)
            .filter(
                ProductColorVariant.product_id == product.id,
                ProductColorVariant.color_name == cv_data.color_name,
            )
            .first()
        )
        if not color_variant:
            continue
        for v_data in cv_data.variants:
            variant = ProductVariant(
                product_color_variant_id=color_variant.id,
                size=v_data.size,
                stock_quantity=v_data.stock_quantity,
            )
            db.add(variant)
    db.commit()

    # Add styles
    for style_id in product_data.styles or []:
        style = db.query(Style).filter(Style.id == style_id).first()
        if not style:
            raise HTTPException(
                status_code=400, detail=f"Style with ID {style_id} not found"
            )
        product_style = ProductStyle(product_id=product.id, style_id=style_id)
        db.add(product_style)
    db.commit()
    db.refresh(product)

    return product_to_schema(product)


@app.put("/api/v1/brands/products/{product_id}", response_model=schemas.Product)
async def update_product(
    product_id: str,
    product_data: schemas.ProductUpdateRequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Update an existing product for the authenticated brand user"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден. Возможно, он был удален или перемещен.",
        )

    # Ensure the product belongs to the current brand user
    if product.brand_id != current_user.id:
        raise HTTPException(status_code=403, detail="Product does not belong to your brand")

    # Update product fields
    for field, value in product_data.dict(exclude_unset=True).items():
        if field == "color_variants":
            # Collect all variant IDs referenced by order_items across this product
            all_variant_ids = [
                v.id for cv in product.color_variants for v in cv.variants
            ]
            if all_variant_ids:
                referenced_variant_ids = {
                    row[0]
                    for row in db.execute(
                        text(
                            "SELECT DISTINCT product_variant_id FROM order_items "
                            "WHERE product_variant_id = ANY(:ids)"
                        ),
                        {"ids": all_variant_ids},
                    ).fetchall()
                }
            else:
                referenced_variant_ids = set()

            incoming_color_names = {cv_data["color_name"] for cv_data in value}
            existing_by_name = {cv.color_name: cv for cv in product.color_variants}

            # Remove color variants no longer in the incoming list
            for color_name, cv in existing_by_name.items():
                if color_name not in incoming_color_names:
                    has_referenced = any(
                        v.id in referenced_variant_ids for v in cv.variants
                    )
                    if has_referenced:
                        # Can't delete — zero stock on all its variants instead
                        for v in cv.variants:
                            v.stock_quantity = 0
                    else:
                        db.delete(cv)
            db.flush()

            # Upsert incoming color variants
            for order_index, cv_data in enumerate(value):
                cv = existing_by_name.get(cv_data["color_name"])
                if cv:
                    # Update existing color variant in place
                    cv.color_hex = cv_data["color_hex"]
                    cv.images = cv_data.get("images") or []
                    cv.display_order = order_index
                    # Upsert size variants
                    existing_variants_by_size = {v.size: v for v in cv.variants}
                    incoming_sizes = {v_data["size"] for v_data in cv_data.get("variants") or []}
                    for size, v in existing_variants_by_size.items():
                        if size not in incoming_sizes:
                            if v.id not in referenced_variant_ids:
                                db.delete(v)
                            else:
                                v.stock_quantity = 0
                    for v_data in cv_data.get("variants") or []:
                        existing_v = existing_variants_by_size.get(v_data["size"])
                        if existing_v:
                            existing_v.stock_quantity = v_data["stock_quantity"]
                        else:
                            db.add(ProductVariant(
                                product_color_variant_id=cv.id,
                                size=v_data["size"],
                                stock_quantity=v_data["stock_quantity"],
                            ))
                else:
                    # New color variant
                    new_cv = ProductColorVariant(
                        product_id=product.id,
                        color_name=cv_data["color_name"],
                        color_hex=cv_data["color_hex"],
                        images=cv_data.get("images") or [],
                        display_order=order_index,
                    )
                    db.add(new_cv)
                    db.flush()
                    for v_data in cv_data.get("variants") or []:
                        db.add(ProductVariant(
                            product_color_variant_id=new_cv.id,
                            size=v_data["size"],
                            stock_quantity=v_data["stock_quantity"],
                        ))
            db.commit()
        elif field == "styles":
            db.query(ProductStyle).filter(
                ProductStyle.product_id == product.id
            ).delete()
            for style_id in value:
                style = db.query(Style).filter(Style.id == style_id).first()
                if not style:
                    raise HTTPException(
                        status_code=400, detail=f"Style with ID {style_id} not found"
                    )
                product_style = ProductStyle(product_id=product.id, style_id=style_id)
                db.add(product_style)
        elif field == "material":
            product.material = value
        elif field == "general_images":
            product.general_images = value or []
        elif field not in ["sku"]:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)

    return product_to_schema(product)


@app.get("/api/v1/brands/products", response_model=List[schemas.Product])
async def get_brand_products(
    current_user: User = Depends(get_current_brand_user), db: Session = Depends(get_db)
):
    """Get all products for the authenticated brand user"""
    products = db.query(Product).filter(Product.brand_id == current_user.id).all()
    return [product_to_schema(p) for p in products]


@app.get("/api/v1/brands/products/{product_id}", response_model=schemas.Product)
async def get_brand_product_details(
    product_id: str,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Get details of a specific product for the authenticated brand user"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден. Возможно, он был удален или перемещен.",
        )
    if product.brand_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Product does not belong to your brand"
        )
    return product_to_schema(product)


@app.put("/api/v1/brands/orders/{order_id}/tracking", response_model=MessageResponse)
async def update_order_tracking(
    order_id: str,
    tracking_data: schemas.UpdateTrackingRequest,
    current_user: Brand = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Update tracking number and link for an order. Once both are set and order is PAID, status becomes SHIPPED."""
    order = db.query(Order).filter(Order.id == int(str(order_id))).first()  # type: ignore
    if not order:
        raise HTTPException(
            status_code=404,
            detail="Заказ не найден. Проверьте правильность номера заказа.",
        )

    brand_id_filter = int(current_user.id)
    order_belongs_to_brand = (
        db.query(OrderItem)
        .join(ProductVariant, OrderItem.product_variant_id == ProductVariant.id)
        .join(
            ProductColorVariant,
            ProductVariant.product_color_variant_id == ProductColorVariant.id,
        )
        .join(Product, ProductColorVariant.product_id == Product.id)
        .filter(OrderItem.order_id == order_id, Product.brand_id == brand_id_filter)
        .first()
    )

    if not order_belongs_to_brand:
        raise HTTPException(
            status_code=403, detail="Order does not belong to your brand"
        )

    if tracking_data.tracking_number is not None:
        order.tracking_number = tracking_data.tracking_number.strip() or None
    if tracking_data.tracking_link is not None:
        order.tracking_link = tracking_data.tracking_link.strip() or None

    # Transition to SHIPPED when tracking is complete and order was PAID
    if (
        order.status == OrderStatus.PAID
        and order.tracking_number
        and order.tracking_link
    ):
        payment_service.update_order_status(str(order.id), OrderStatus.SHIPPED.value)  # type: ignore

    db.commit()
    return {"message": "Tracking information updated successfully"}


@app.put("/api/v1/brands/orders/{order_id}/return", response_model=MessageResponse)
async def mark_order_returned(
    order_id: str,
    current_user: Brand = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Mark an order as RETURNED after the brand has received the returned item. Only SHIPPED orders can be returned."""
    order = db.query(Order).filter(Order.id == int(str(order_id))).first()  # type: ignore
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден.")

    brand_id_filter = int(current_user.id)
    order_belongs_to_brand = (
        db.query(OrderItem)
        .join(ProductVariant, OrderItem.product_variant_id == ProductVariant.id)
        .join(
            ProductColorVariant,
            ProductVariant.product_color_variant_id == ProductColorVariant.id,
        )
        .join(Product, ProductColorVariant.product_id == Product.id)
        .filter(OrderItem.order_id == order_id, Product.brand_id == brand_id_filter)
        .first()
    )

    if not order_belongs_to_brand:
        raise HTTPException(
            status_code=403, detail="Order does not belong to your brand"
        )

    if order.status == OrderStatus.CANCELED:  # type: ignore
        raise HTTPException(
            status_code=400,
            detail=f"Only SHIPPED orders can be marked as returned. Current status: {order.status.value}",
        )

    payment_service.update_order_status(str(order.id), OrderStatus.RETURNED.value)  # type: ignore
    db.commit()
    return {"message": "Order marked as returned. Stock has been restored."}


class UpdateOrderItemSKURequest(BaseModel):
    sku: str


@app.put(
    "/api/v1/brands/order-items/{order_item_id}/sku", response_model=MessageResponse
)
async def update_order_item_sku(
    order_item_id: str,
    sku_data: UpdateOrderItemSKURequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db),
):
    """Update SKU for a specific order item belonging to the authenticated brand user"""
    order_item = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    variant = (
        db.query(ProductVariant)
        .filter(ProductVariant.id == order_item.product_variant_id)
        .first()
    )
    if not variant:
        raise HTTPException(status_code=404, detail="Product variant not found")
    product = variant.product
    if not product or product.brand_id != int(current_user.id):
        raise HTTPException(
            status_code=403, detail="Order item does not belong to your brand"
        )

    if not order_item.sku:  # type: ignore
        raise HTTPException(
            status_code=400, detail="SKU already assigned and cannot be changed."
        )

    order_item.sku = sku_data.sku
    db.commit()
    return {"message": "SKU updated successfully"}


@app.get("/api/v1/user/profile/completion-status")
async def get_profile_completion_status(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Check user profile completion status"""
    missing_fields = []
    required_screens = []

    is_gender_complete = (
        current_user.profile.gender is not None if current_user.profile else False
    )
    user_id = str(current_user.id)
    is_brands_complete = (
        db.query(UserBrand).filter(UserBrand.user_id == user_id).count() > 0
    )
    is_styles_complete = (
        db.query(UserStyle).filter(UserStyle.user_id == user_id).count() > 0
    )

    is_complete = is_gender_complete and is_brands_complete and is_styles_complete

    if not is_gender_complete:
        missing_fields.append("gender")
        required_screens.append(
            "confirmation"
        )  # Assuming a screen for gender selection
    if not is_brands_complete:
        missing_fields.append("favorite_brands")
        required_screens.append(
            "brand_selection"
        )  # Assuming a screen for brand selection
    if not is_styles_complete:
        missing_fields.append("favorite_styles")
        required_screens.append(
            "style_selection"
        )  # Assuming a screen for style selection

    return {
        "isComplete": is_complete,
        "missingFields": missing_fields,
        "requiredScreens": required_screens,
    }


@app.get("/api/v1/user/oauth-accounts")
async def get_oauth_accounts(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get user's OAuth accounts"""
    oauth_accounts = (
        db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).all()
    )

    return [
        {
            "id": account.id,
            "provider": account.provider,
            "provider_user_id": account.provider_user_id,
            "created_at": account.created_at,
            "updated_at": account.updated_at,
        }
        for account in oauth_accounts
    ]


# Enhanced User Profile Management
@app.put("/api/v1/user/profile", response_model=schemas.UserProfileResponse)
async def update_user_profile(
    profile_data: schemas.UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user core information (username/email only)"""
    # Update user fields only
    if profile_data.username is not None:
        current_user.username = profile_data.username
    if profile_data.email is not None:
        if (
            db.query(AuthAccount)
            .filter(
                AuthAccount.email == profile_data.email,
                AuthAccount.id != current_user.auth_account_id,
            )
            .first()
        ):
            raise HTTPException(
                status_code=400, detail="Email already registered to another account"
            )
        current_user.auth_account.email = profile_data.email

    current_user.updated_at = datetime.utcnow()  # type: ignore
    db.commit()
    db.refresh(current_user)

    # Return updated profile using get_user_profile logic
    return await get_user_profile(current_user, db)


@app.put("/api/v1/user/profile/data", response_model=schemas.ProfileResponse)
async def update_user_profile_data(
    profile_data: schemas.ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user profile data (name, gender, size, avatar)"""
    user_id = str(current_user.id)

    # Get or create profile
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)

    # Update profile fields
    if profile_data.full_name is not None:
        profile.full_name = profile_data.full_name
    if profile_data.gender is not None:
        profile.gender = Gender(profile_data.gender) if profile_data.gender else None
    if profile_data.selected_size is not None:
        profile.selected_size = profile_data.selected_size
    if profile_data.avatar_url is not None:
        profile.avatar_url = profile_data.avatar_url
    if profile_data.avatar_url_full is not None:
        profile.avatar_url_full = profile_data.avatar_url_full
    if profile_data.avatar_crop is not None:
        profile.avatar_crop = profile_data.avatar_crop
    if profile_data.avatar_transform is not None:
        profile.avatar_transform = profile_data.avatar_transform

    profile.updated_at = datetime.utcnow()  # type: ignore
    db.commit()
    db.refresh(profile)

    return schemas.ProfileResponse(
        full_name=str(profile.full_name) if profile.full_name else None,  # type: ignore
        gender=profile.gender.value if profile.gender else None,  # type: ignore
        selected_size=str(profile.selected_size) if profile.selected_size else None,  # type: ignore
        avatar_url=str(profile.avatar_url) if profile.avatar_url else None,  # type: ignore
        avatar_url_full=str(profile.avatar_url_full)
        if profile.avatar_url_full
        else None,  # type: ignore
        avatar_crop=str(profile.avatar_crop) if profile.avatar_crop else None,  # type: ignore
        avatar_transform=str(profile.avatar_transform)
        if profile.avatar_transform
        else None,  # type: ignore
    )


@app.post(
    "/api/v1/user/upload/presigned-url", response_model=schemas.PresignedUploadResponse
)
async def get_avatar_presigned_url(
    body: schemas.PresignedUploadRequest,
    current_user: User = Depends(get_current_user),
):
    """Get a presigned URL to upload an avatar image. Upload with PUT to upload_url, then set profile avatar_url to public_url."""
    if isinstance(current_user, Brand):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use brand upload for product images.",
        )
    if not s3_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Image upload is not configured.",
        )

    # Validate that the requested content type is an allowed image MIME type
    validate_image_content_type(body.content_type)

    ext = determine_file_extension(body.content_type, body.filename)
    key = generate_key("avatars", ext, prefix=str(current_user.id))
    upload_url, public_url = generate_presigned_upload_url(key, body.content_type)
    return schemas.PresignedUploadResponse(
        upload_url=upload_url, public_url=public_url, key=key
    )


@app.put("/api/v1/user/shipping", response_model=schemas.ShippingInfoResponse)
async def update_user_shipping_info(
    shipping_data: schemas.ShippingInfoUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user shipping/delivery information"""
    user_id = str(current_user.id)

    # Get or create shipping info
    shipping_info = (
        db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
    )
    if not shipping_info:
        shipping_info = UserShippingInfo(user_id=user_id)
        db.add(shipping_info)

    # Update shipping fields
    if shipping_data.delivery_email is not None:
        shipping_info.delivery_email = shipping_data.delivery_email
    if shipping_data.phone is not None:
        shipping_info.phone = shipping_data.phone
    if shipping_data.street is not None:
        shipping_info.street = shipping_data.street
    if shipping_data.house_number is not None:
        shipping_info.house_number = shipping_data.house_number
    if shipping_data.apartment_number is not None:
        shipping_info.apartment_number = shipping_data.apartment_number
    if shipping_data.city is not None:
        shipping_info.city = shipping_data.city
    if shipping_data.postal_code is not None:
        shipping_info.postal_code = shipping_data.postal_code

    shipping_info.updated_at = datetime.utcnow()  # type: ignore
    db.commit()
    db.refresh(shipping_info)

    return schemas.ShippingInfoResponse(
        delivery_email=str(shipping_info.delivery_email)
        if shipping_info.delivery_email
        else None,  # type: ignore
        phone=str(shipping_info.phone) if shipping_info.phone else None,  # type: ignore
        street=str(shipping_info.street) if shipping_info.street else None,  # type: ignore
        house_number=str(shipping_info.house_number)
        if shipping_info.house_number
        else None,  # type: ignore
        apartment_number=str(shipping_info.apartment_number)
        if shipping_info.apartment_number
        else None,  # type: ignore
        city=str(shipping_info.city) if shipping_info.city else None,  # type: ignore
        postal_code=str(shipping_info.postal_code)
        if shipping_info.postal_code
        else None,  # type: ignore
    )


@app.put("/api/v1/user/preferences", response_model=schemas.PreferencesResponse)
async def update_user_preferences(
    preferences_data: schemas.PreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user preferences (privacy and notifications)"""
    user_id = str(current_user.id)

    # Get or create preferences
    preferences = (
        db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    )
    if not preferences:
        preferences = UserPreferences(user_id=user_id)
        db.add(preferences)

    # Update preference fields
    if preferences_data.size_privacy is not None:
        preferences.size_privacy = PrivacyOption(preferences_data.size_privacy)
    if preferences_data.recommendations_privacy is not None:
        preferences.recommendations_privacy = PrivacyOption(
            preferences_data.recommendations_privacy
        )
    if preferences_data.likes_privacy is not None:
        preferences.likes_privacy = PrivacyOption(preferences_data.likes_privacy)
    if preferences_data.order_notifications is not None:
        preferences.order_notifications = preferences_data.order_notifications
    if preferences_data.marketing_notifications is not None:
        preferences.marketing_notifications = preferences_data.marketing_notifications

    preferences.updated_at = datetime.utcnow()  # type: ignore
    db.commit()
    db.refresh(preferences)

    return schemas.PreferencesResponse(
        size_privacy=preferences.size_privacy.value
        if preferences.size_privacy
        else None,
        recommendations_privacy=preferences.recommendations_privacy.value
        if preferences.recommendations_privacy
        else None,
        likes_privacy=preferences.likes_privacy.value
        if preferences.likes_privacy
        else None,
        order_notifications=bool(preferences.order_notifications),  # type: ignore
        marketing_notifications=bool(preferences.marketing_notifications),  # type: ignore
    )


# Brand Management
@app.get("/api/v1/brands", response_model=List[BrandResponse])
async def get_brands(db: Session = Depends(get_db)):
    """Get all available brands"""
    brands = db.query(Brand).all()
    return [
        BrandResponse(
            id=int(brand.id),  # type: ignore
            name=str(brand.name),  # type: ignore
            slug=str(brand.slug),  # type: ignore
            logo=str(brand.logo) if brand.logo else None,  # type: ignore
            description=str(brand.description) if brand.description else None,  # type: ignore
            shipping_price=float(brand.shipping_price)
            if brand.shipping_price
            else None,  # type: ignore
            min_free_shipping=int(brand.min_free_shipping)
            if brand.min_free_shipping
            else None,  # type: ignore
        )
        for brand in brands
    ]


@app.post("/api/v1/user/brands")
async def update_user_brands(
    brands_data: UserBrandsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's favorite brands"""
    # Remove existing brand associations
    user_id = str(current_user.id)
    db.query(UserBrand).filter(UserBrand.user_id == user_id).delete()

    # Add new brand associations
    for brand_id in brands_data.brand_ids:
        # Verify brand exists
        brand = db.query(Brand).filter(Brand.id == brand_id).first()
        if not brand:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Brand with ID {brand_id} not found",
            )

        user_brand = UserBrand(user_id=user_id, brand_id=brand_id)
        db.add(user_brand)

    db.commit()
    return {"message": "Favorite brands updated successfully"}


# Style Management
@app.get("/api/v1/styles", response_model=List[schemas.StyleResponse])
async def get_styles(db: Session = Depends(get_db)):
    """Get all available styles"""
    styles = db.query(Style).all()
    return [
        schemas.StyleResponse(
            id=style.id, name=style.name, description=style.description
        )
        for style in styles
    ]


@app.post("/api/v1/user/styles")
async def update_user_styles(
    styles_data: UserStylesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update user's favorite styles"""
    # Remove existing style associations
    user_id = str(current_user.id)
    db.query(UserStyle).filter(UserStyle.user_id == user_id).delete()

    # Add new style associations
    for style_id in styles_data.style_ids:
        # Verify style exists
        style = db.query(Style).filter(Style.id == style_id).first()
        if not style:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Style with ID {style_id} not found",
            )

        user_style = UserStyle(user_id=user_id, style_id=style_id)
        db.add(user_style)

    db.commit()
    return {"message": "Favorite styles updated successfully"}


@app.get("/api/v1/categories", response_model=List[CategoryResponse])
async def get_categories(db: Session = Depends(get_db)):
    """Get all available categories"""
    categories = db.query(Category).all()
    return [
        CategoryResponse(
            id=category.id, name=category.name, description=category.description
        )
        for category in categories
    ]


# Liking Items Endpoint
@app.post("/api/v1/user/favorites/toggle", response_model=MessageResponse)
async def toggle_favorite_item(
    toggle_data: ToggleFavoriteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add or remove an item from the user's favorites (liked items)"""
    product_id = toggle_data.product_id
    action = toggle_data.action

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Product not found"
        )

    existing_like = (
        db.query(UserLikedProduct)
        .filter(
            UserLikedProduct.user_id == current_user.id,
            UserLikedProduct.product_id == product_id,
        )
        .first()
    )

    if action == "like":
        if existing_like:
            return {"message": "Item already liked."}
        else:
            user_liked_product = UserLikedProduct(
                user_id=current_user.id, product_id=product_id
            )
            db.add(user_liked_product)
            db.commit()
            return {"message": "Item liked successfully."}
    elif action == "unlike":
        if existing_like:
            db.delete(existing_like)
            db.commit()
            return {"message": "Item unliked successfully."}
        else:
            return {"message": "Item is not liked."}


# Get User Favorites Endpoint
@app.get("/api/v1/user/favorites", response_model=List[schemas.Product])
async def get_user_favorites(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all products liked by the current user"""
    liked_products = (
        db.query(Product)
        .join(UserLikedProduct)
        .join(Brand)
        .filter(UserLikedProduct.user_id == current_user.id)
        .all()
    )

    return [product_to_schema(p, is_liked=True) for p in liked_products]


# Get Recent Swipes Endpoint
@app.get("/api/v1/user/recent-swipes", response_model=List[schemas.Product])
async def get_recent_swipes(
    limit: int = 5,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the most recently swiped products for the current user (up to 5)"""
    # Get recent swipes ordered by created_at descending, limit to 5
    recent_swipes = (
        db.query(UserSwipe)
        .filter(UserSwipe.user_id == current_user.id)
        .order_by(UserSwipe.created_at.desc())
        .limit(limit)
        .all()
    )

    # Extract product IDs, maintaining order
    product_ids = [swipe.product_id for swipe in recent_swipes]

    # Get products in the same order
    products = db.query(Product).join(Brand).filter(Product.id.in_(product_ids)).all()

    # Create a map for quick lookup
    product_map = {product.id: product for product in products}

    # Build results in the order of swipes
    results = []
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    for product_id in product_ids:
        product = product_map.get(product_id)
        if product:
            results.append(
                product_to_schema(product, is_liked=product.id in liked_product_ids)
            )
    return results


# Item Recommendations Endpoints
@app.get("/api/v1/recommendations/for_user", response_model=List[schemas.Product])
async def get_recommendations_for_user(
    limit: int = 5,  # Default to 5 products
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Provide recommended items for the current user"""
    # This is a placeholder for a real recommendation engine.
    # For now, return a few random products and mark if liked by the user
    all_products = (
        db.query(Product).join(Brand).order_by(func.random()).limit(limit).all()
    )  # Get random products
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    return [
        product_to_schema(p, is_liked=p.id in liked_product_ids) for p in all_products
    ]


@app.get(
    "/api/v1/recommendations/for_friend/{friend_id}",
    response_model=List[schemas.Product],
)
async def get_recommendations_for_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Provide recommended items for a specific friend"""
    friend_user = db.query(User).filter(User.id == friend_id).first()
    if not friend_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Friend not found."
        )

    all_products = (
        db.query(Product).join(Brand).order_by(func.random()).limit(8).all()
    )  # Get 8 random products
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    return [
        product_to_schema(p, is_liked=p.id in liked_product_ids) for p in all_products
    ]


# In-memory cache for popular items with TTL
_popular_items_cache: Optional[List[schemas.Product]] = None
_popular_items_cache_time: Optional[float] = None
POPULAR_ITEMS_CACHE_TTL = 5 * 60  # 5 minutes in seconds


def invalidate_popular_items_cache():
    """Invalidate the popular items cache (call when purchase counts change)"""
    global _popular_items_cache, _popular_items_cache_time
    _popular_items_cache = None
    _popular_items_cache_time = None
    print("Popular items cache invalidated")


@app.get("/api/v1/products/popular", response_model=List[schemas.Product])
async def get_popular_products(
    limit: int = 16,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the most popular products (most purchased)"""
    global _popular_items_cache, _popular_items_cache_time

    # Check if cache is valid
    current_time = time.time()
    if _popular_items_cache and _popular_items_cache_time:
        cache_age = current_time - _popular_items_cache_time
        if cache_age < POPULAR_ITEMS_CACHE_TTL:
            print(f"Returning cached popular items (age: {cache_age:.1f}s)")
            return _popular_items_cache

    # Cache expired or doesn't exist, fetch from database
    print("Fetching fresh popular items from database")
    # Query products ordered by purchase_count descending, limit to top products
    products = (
        db.query(Product)
        .join(Brand)
        .order_by(
            Product.purchase_count.desc(),
            Product.created_at.desc(),  # Secondary sort by creation date for consistency
        )
        .limit(limit)
        .all()
    )

    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    results = [
        product_to_schema(p, is_liked=p.id in liked_product_ids) for p in products
    ]
    # Update cache
    _popular_items_cache = results
    _popular_items_cache_time = current_time

    return results


@app.get("/api/v1/products/search", response_model=List[schemas.Product])
async def search_products(
    query: Optional[str] = None,
    category: Optional[str] = None,
    categories: Optional[List[str]] = Query(default=None),
    brand: Optional[str] = None,
    brands: Optional[List[str]] = Query(default=None),
    style: Optional[str] = None,
    styles: Optional[List[str]] = Query(default=None),
    limit: int = 16,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for products based on query and filters. Supports multiple values per filter (OR logic)."""
    products_query = db.query(Product).join(Brand)

    # Apply search query
    if query:
        search_pattern = f"%{query}%"
        products_query = products_query.filter(
            (Product.name.ilike(search_pattern))
            | (Product.description.ilike(search_pattern))
            | (Product.article_number.ilike(search_pattern))  # Search by article number
        )

    # Apply filters - support both legacy single values and new multiple values
    cat_values = (
        categories
        if categories
        else ([category] if category and category != "Категория" else [])
    )
    if cat_values:
        products_query = products_query.filter(Product.category_id.in_(cat_values))

    brand_values = brands if brands else ([brand] if brand and brand != "Бренд" else [])
    if brand_values:
        products_query = products_query.filter(
            or_(*[Brand.name.ilike(f"%{b}%") for b in brand_values])
        )

    style_values = styles if styles else ([style] if style and style != "Стиль" else [])
    if style_values:
        products_query = (
            products_query.join(ProductStyle)
            .join(Style)
            .filter(or_(*[Style.name.ilike(f"%{s}%") for s in style_values]))
        )

    # Apply pagination - use distinct() to prevent duplicate products when filtering by style
    products_query = products_query.distinct().offset(offset).limit(limit)

    products = products_query.all()
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    return [product_to_schema(p, is_liked=p.id in liked_product_ids) for p in products]


@app.get("/api/v1/products/{product_id}", response_model=schemas.Product)
async def get_product_details(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get details of a specific product for regular users"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=404,
            detail="Товар не найден. Возможно, он был удален или перемещен.",
        )

    # Check if user has liked this product
    is_liked = any(ulp.product_id == product.id for ulp in current_user.liked_products)

    return product_to_schema(product, is_liked=is_liked)


# Friend System Endpoints
@app.post("/api/v1/friends/request", response_model=MessageResponse)
async def send_friend_request(
    request_data: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a friend request to another user"""
    # Find recipient by username or email
    recipient = None
    if "@" in request_data.recipient_identifier:
        recipient = (
            db.query(User)
            .join(AuthAccount)
            .filter(AuthAccount.email == request_data.recipient_identifier)
            .first()
        )
    else:
        recipient = (
            db.query(User)
            .filter(User.username == request_data.recipient_identifier)
            .first()
        )

    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="User not found"
        )

    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send friend request to yourself",
        )

    # Check if already friends
    existing_friendship = (
        db.query(Friendship)
        .filter(
            (
                (Friendship.user_id == current_user.id)
                & (Friendship.friend_id == recipient.id)
            )
            | (
                (Friendship.user_id == recipient.id)
                & (Friendship.friend_id == current_user.id)
            )
        )
        .first()
    )

    if existing_friendship:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Already friends"
        )

    # Check if friend request already exists
    existing_request = (
        db.query(FriendRequest)
        .filter(
            (
                (FriendRequest.sender_id == current_user.id)
                & (FriendRequest.recipient_id == recipient.id)
            )
            | (
                (FriendRequest.sender_id == recipient.id)
                & (FriendRequest.recipient_id == current_user.id)
            )
        )
        .first()
    )

    if existing_request:
        if existing_request.status == FriendRequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Friend request already pending",
            )

    # Create new friend request
    friend_request = FriendRequest(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        status=FriendRequestStatus.PENDING,
    )

    db.add(friend_request)
    db.commit()

    return {"message": "Friend request sent."}


@app.get("/api/v1/friends/requests/sent", response_model=List[FriendRequestResponse])
async def get_sent_friend_requests(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get sent friend requests"""
    requests = (
        db.query(FriendRequest).filter(FriendRequest.sender_id == current_user.id).all()
    )

    return [
        {
            "id": req.id,
            "recipient": {"id": req.recipient.id, "username": req.recipient.username},
            "status": req.status,
        }
        for req in requests
    ]


@app.get(
    "/api/v1/friends/requests/received",
    response_model=List[ReceivedFriendRequestResponse],
)
async def get_received_friend_requests(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get received friend requests"""
    requests = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.recipient_id == current_user.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .all()
    )

    return [
        {
            "id": req.id,
            "sender": {"id": req.sender.id, "username": req.sender.username},
            "status": req.status,
        }
        for req in requests
    ]


@app.post(
    "/api/v1/friends/requests/{request_id}/accept", response_model=MessageResponse
)
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Accept a friend request"""
    friend_request = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.id == request_id,
            FriendRequest.recipient_id == current_user.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .first()
    )

    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found or not pending",
        )

    # Update request status
    friend_request.status = FriendRequestStatus.ACCEPTED  # type: ignore
    friend_request.updated_at = datetime.utcnow()  # type: ignore

    # Create friendship
    friendship = Friendship(
        user_id=friend_request.sender_id, friend_id=friend_request.recipient_id
    )

    db.add(friendship)
    db.delete(friend_request)  # Delete the friend request after acceptance
    db.commit()

    return {"message": "Friend request accepted."}


@app.post(
    "/api/v1/friends/requests/{request_id}/reject", response_model=MessageResponse
)
async def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reject a friend request"""
    friend_request = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.id == request_id,
            FriendRequest.recipient_id == current_user.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .first()
    )

    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found or not pending",
        )

    friend_request.status = FriendRequestStatus.REJECTED  # type: ignore
    friend_request.updated_at = datetime.utcnow()  # type: ignore
    db.delete(friend_request)  # Delete the friend request after rejection
    db.commit()

    return {"message": "Friend request rejected."}


@app.delete(
    "/api/v1/friends/requests/{request_id}/cancel", response_model=MessageResponse
)
async def cancel_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cancel a sent friend request"""
    friend_request = (
        db.query(FriendRequest)
        .filter(
            FriendRequest.id == request_id,
            FriendRequest.sender_id == current_user.id,
            FriendRequest.status == FriendRequestStatus.PENDING,
        )
        .first()
    )

    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found or not pending",
        )

    friend_request.status = FriendRequestStatus.CANCELLED  # type: ignore
    friend_request.updated_at = datetime.utcnow()  # type: ignore
    db.delete(friend_request)  # Delete the friend request after cancellation
    db.commit()

    return {"message": "Friend request cancelled."}


@app.get("/api/v1/friends", response_model=List[FriendResponse])
async def get_friends_list(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get user's friends list"""
    # Get friendships where current user is either user or friend
    friendships = (
        db.query(Friendship)
        .filter(
            (Friendship.user_id == current_user.id)
            | (Friendship.friend_id == current_user.id)
        )
        .all()
    )

    friends = []
    for friendship in friendships:
        if friendship.user_id == current_user.id:  # type: ignore
            friend_user = db.query(User).filter(User.id == friendship.friend_id).first()
        else:
            friend_user = db.query(User).filter(User.id == friendship.user_id).first()

        if friend_user:
            avatar_url = friend_user.profile.avatar_url if friend_user.profile else None
            friends.append(
                {
                    "id": friend_user.id,
                    "username": friend_user.username,
                    "avatar_url": avatar_url,
                }
            )

    return friends


@app.delete("/api/v1/friends/{friend_id}", response_model=MessageResponse)
async def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a friend"""
    # Find the friendship entry
    friendship = (
        db.query(Friendship)
        .filter(
            (
                (Friendship.user_id == current_user.id)
                & (Friendship.friend_id == friend_id)
            )
            | (
                (Friendship.user_id == friend_id)
                & (Friendship.friend_id == current_user.id)
            )
        )
        .first()
    )

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Friendship not found"
        )

    db.delete(friendship)
    db.commit()

    return {"message": "Friend removed successfully"}


@app.get("/api/v1/users/search", response_model=List[UserSearchResponse])
async def search_users(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search for users by username or email"""
    if len(query) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters",
        )

    # Search by username or email (case insensitive)
    users = (
        db.query(User)
        .join(AuthAccount)
        .filter(
            (User.username.ilike(f"%{query}%") | AuthAccount.email.ilike(f"%{query}%"))
            & (User.id != current_user.id)
        )
        .limit(20)
        .all()
    )

    result = []
    for user in users:
        friend_status = "not_friend"

        # Check if already friends
        existing_friendship = (
            db.query(Friendship)
            .filter(
                (
                    (Friendship.user_id == current_user.id)
                    & (Friendship.friend_id == user.id)
                )
                | (
                    (Friendship.user_id == user.id)
                    & (Friendship.friend_id == current_user.id)
                )
            )
            .first()
        )

        if existing_friendship:
            friend_status = "friend"
        else:
            # Check for pending friend requests
            sent_request = (
                db.query(FriendRequest)
                .filter(
                    FriendRequest.sender_id == current_user.id,
                    FriendRequest.recipient_id == user.id,
                    FriendRequest.status == FriendRequestStatus.PENDING,
                )
                .first()
            )

            received_request = (
                db.query(FriendRequest)
                .filter(
                    FriendRequest.sender_id == user.id,
                    FriendRequest.recipient_id == current_user.id,
                    FriendRequest.status == FriendRequestStatus.PENDING,
                )
                .first()
            )

            if sent_request:
                friend_status = "request_sent"
            elif received_request:
                friend_status = "request_received"

        avatar_url = user.profile.avatar_url if user.profile else None
        result.append(
            {
                "id": user.id,
                "username": user.username,
                "email": user.auth_account.email,
                "avatar_url": avatar_url,
                "friend_status": friend_status,
            }
        )

    return result


@app.get("/api/v1/users/{user_id}/profile", response_model=PublicUserProfileResponse)
async def get_public_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get public profile of another user"""
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    gender = user.profile.gender.value if user.profile and user.profile.gender else None
    avatar_url = user.profile.avatar_url if user.profile else None
    return {
        "id": user.id,
        "username": user.username,
        "gender": gender,
        "avatar_url": avatar_url,
    }


# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "version": "1.0.0",
        "database": "postgresql",
        "oauth_providers": [
            "google" if settings.GOOGLE_CLIENT_ID else None,
            "facebook" if settings.FACEBOOK_CLIENT_ID else None,
            "github" if settings.GITHUB_CLIENT_ID else None,
            "apple" if settings.APPLE_CLIENT_ID else None,
        ],
    }


@app.post("/api/v1/payments/create", response_model=PaymentCreateResponse)
async def create_payment_endpoint(
    payment_data: schemas.PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        confirmation_url = payment_service.create_payment(
            db=db,
            user_id=current_user.id,
            amount=payment_data.amount.value,
            currency=payment_data.amount.currency,
            description=payment_data.description,
            return_url=payment_data.returnUrl,
            items=payment_data.items,
        )
        # print(f"Receipt data sent to payment_service: {payment_data.receipt.dict() if payment_data.receipt else None}")
        return PaymentCreateResponse(confirmation_url=confirmation_url)
    except ValidationError as e:
        print(f"Pydantic Validation Error: {e.errors()}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=e.errors()
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e)
        )


def _order_to_summary(order: Order) -> schemas.OrderSummaryResponse:
    return schemas.OrderSummaryResponse(
        id=str(order.id),  # type: ignore
        number=str(order.order_number),  # type: ignore
        total_amount=float(order.total_amount),  # type: ignore
        currency="RUB",
        date=order.created_at,  # type: ignore
        status=order.status.value,
        tracking_number=str(order.tracking_number) if order.tracking_number else None,  # type: ignore
        tracking_link=str(order.tracking_link) if order.tracking_link else None,  # type: ignore
        shipping_cost=float(order.shipping_cost or 0.0),  # type: ignore
    )


def _checkout_to_summary(checkout: Checkout) -> schemas.OrderSummaryResponse:
    first_order = next((o for o in checkout.orders), None)
    number = first_order.order_number if first_order else str(checkout.id)[:8]
    status = first_order.status.value if first_order else "pending"
    tracking = (
        first_order.tracking_number
        if first_order and len(checkout.orders) == 1
        else None
    )
    tracking_link = (
        first_order.tracking_link if first_order and len(checkout.orders) == 1 else None
    )
    total_shipping = sum(float(o.shipping_cost or 0.0) for o in checkout.orders)  # type: ignore
    return schemas.OrderSummaryResponse(
        id=str(checkout.id),  # type: ignore
        number=number,
        total_amount=float(checkout.total_amount),  # type: ignore
        currency="RUB",
        date=checkout.created_at,  # type: ignore
        status=status,
        tracking_number=tracking,
        tracking_link=tracking_link,
        shipping_cost=total_shipping,
    )


def _allocated_shipping_for_order(order: Order) -> list:
    """Allocate order.shipping_cost across items by line total. Returns list of floats, one per item."""
    total = order.shipping_cost or 0
    if total == 0 or not order.items:
        return [0.0] * len(order.items) if order.items else []
    subtotal = order.subtotal or sum(
        item.price * getattr(item, "quantity", 1) for item in order.items
    )
    if subtotal <= 0:
        per_item = total / len(order.items)
        return [per_item] * len(order.items)
    allocated = []
    for item in order.items:
        line = item.price * getattr(item, "quantity", 1)
        allocated.append(round(total * (line / subtotal), 2))
    # Fix rounding: ensure sum equals total by adjusting last item
    diff = total - sum(allocated)
    if allocated and diff != 0:
        allocated[-1] = round(allocated[-1] + diff, 2)
    return allocated


def _build_order_item_response(
    item: OrderItem, allocated_shipping: float = 0.0
) -> schemas.OrderItemResponse:
    product_variant = item.product_variant
    product = product_variant.product
    cv = product_variant.color_variant
    imgs = cv.images or []
    return schemas.OrderItemResponse(
        id=str(item.id),  # type: ignore
        name=product.name,
        price=float(item.price),  # type: ignore
        size=product_variant.size,
        image=imgs[0] if imgs else None,
        delivery=schemas.Delivery(
            cost=allocated_shipping,
            estimatedTime="1-3 дня",
            tracking_number=item.order.tracking_number,
        ),
        sku=str(item.sku) if item.sku else None,  # type: ignore
        brand_name=product.brand.name if product.brand else None,
        description=product.description,
        color=cv.color_name,
        materials=product.material,
        images=imgs,
        return_policy=product.brand.return_policy if product.brand else None,
        product_id=product.id,
    )


def _checkout_to_full_response(checkout: Checkout) -> schemas.CheckoutResponse:
    order_parts = []
    for order in checkout.orders:
        allocated = _allocated_shipping_for_order(order)
        items = [
            _build_order_item_response(
                item, allocated[i] if i < len(allocated) else 0.0
            )
            for i, item in enumerate(order.items)
        ]
        brand = order.brand
        order_parts.append(
            schemas.OrderPartResponse(
                id=order.id,
                number=order.order_number,
                brand_id=order.brand_id,
                brand_name=brand.name if brand else None,
                subtotal=order.subtotal or 0,
                shipping_cost=order.shipping_cost or 0,
                total_amount=order.total_amount,
                status=order.status.value,
                tracking_number=order.tracking_number,
                tracking_link=order.tracking_link,
                items=items,
            )
        )
    return schemas.CheckoutResponse(
        id=str(checkout.id),  # type: ignore
        total_amount=float(checkout.total_amount),  # type: ignore
        currency="RUB",
        date=checkout.created_at,  # type: ignore
        orders=order_parts,
        delivery_full_name=str(checkout.delivery_full_name)
        if checkout.delivery_full_name
        else None,  # type: ignore
        delivery_email=str(checkout.delivery_email)
        if checkout.delivery_email
        else None,  # type: ignore
        delivery_phone=str(checkout.delivery_phone)
        if checkout.delivery_phone
        else None,  # type: ignore
        delivery_address=str(checkout.delivery_address)
        if checkout.delivery_address
        else None,  # type: ignore
        delivery_city=str(checkout.delivery_city) if checkout.delivery_city else None,  # type: ignore
        delivery_postal_code=str(checkout.delivery_postal_code)
        if checkout.delivery_postal_code
        else None,  # type: ignore
    )


def _order_to_full_response(order: Order) -> schemas.OrderResponse:
    allocated = _allocated_shipping_for_order(order)
    order_items = []
    for i, item in enumerate(order.items):
        allocated_cost = allocated[i] if i < len(allocated) else 0.0
        order_items.append(_build_order_item_response(item, allocated_cost))
    fn, em, ph, addr, city, pc = _order_delivery(order)
    return schemas.OrderResponse(
        id=str(order.id),  # type: ignore
        number=str(order.order_number),  # type: ignore
        total_amount=float(order.total_amount),  # type: ignore
        currency="RUB",
        date=order.created_at,  # type: ignore
        status=order.status.value,
        tracking_number=str(order.tracking_number) if order.tracking_number else None,  # type: ignore
        tracking_link=str(order.tracking_link) if order.tracking_link else None,  # type: ignore
        shipping_cost=order.shipping_cost or 0,
        items=order_items,
        delivery_full_name=fn,
        delivery_email=em,
        delivery_phone=ph,
        delivery_address=addr,
        delivery_city=city,
        delivery_postal_code=pc,
    )


@app.post("/api/v1/orders/test", response_model=schemas.OrderTestCreateResponse)
async def create_order_test_endpoint(
    order_data: schemas.OrderTestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an order in test mode (no payment gateway). For development/testing."""
    if isinstance(current_user, Brand):
        raise HTTPException(status_code=403, detail="Brands cannot create orders")
    try:
        checkout_id = payment_service.create_order_test(
            db=db,
            user_id=str(current_user.id),
            amount=order_data.amount.value,
            currency=order_data.amount.currency,
            description=order_data.description,
            items=order_data.items,
        )
        return schemas.OrderTestCreateResponse(order_id=checkout_id)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@app.get("/api/v1/orders", response_model=List[schemas.OrderSummaryResponse])
async def get_orders(
    current_user: any = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get order list. Users see Checkouts; brands see their Orders."""
    is_brand = isinstance(current_user, Brand)

    if is_brand:
        orders = (
            db.query(Order)
            .options(joinedload(Order.items).joinedload(OrderItem.product_variant))
            .join(OrderItem)
            .join(ProductVariant, OrderItem.product_variant_id == ProductVariant.id)
            .join(
                ProductColorVariant,
                ProductVariant.product_color_variant_id == ProductColorVariant.id,
            )
            .join(Product, ProductColorVariant.product_id == Product.id)
            .filter(Product.brand_id == current_user.id)
            .distinct()
            .all()
        )
        return [_order_to_summary(o) for o in orders]
    else:
        checkouts = (
            db.query(Checkout)
            .options(joinedload(Checkout.orders))
            .filter(Checkout.user_id == str(current_user.id))
            .order_by(Checkout.created_at.desc())
            .all()
        )
        return [_checkout_to_summary(c) for c in checkouts]


_order_load = (
    joinedload(Order.checkout),
    joinedload(Order.items)
    .joinedload(OrderItem.product_variant)
    .joinedload(ProductVariant.color_variant)
    .joinedload(ProductColorVariant.product)
    .joinedload(Product.brand),
)


def _order_delivery(order: Order):
    """Delivery fields for OrderResponse; fall back to checkout when order has none (legacy)."""
    c = order.checkout
    return (
        order.delivery_full_name or (c.delivery_full_name if c else None),
        order.delivery_email or (c.delivery_email if c else None),
        order.delivery_phone or (c.delivery_phone if c else None),
        order.delivery_address or (c.delivery_address if c else None),
        order.delivery_city or (c.delivery_city if c else None),
        order.delivery_postal_code or (c.delivery_postal_code if c else None),
    )


@app.get("/api/v1/orders/{order_id}", response_model=schemas.OrderResponse)
async def get_order_by_id(
    order_id: str,
    current_user: any = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full order details for a brand (items, delivery). Caller must be a brand; order must belong to that brand."""
    if not isinstance(current_user, Brand):
        raise HTTPException(
            status_code=403, detail="Only brands can fetch order by order id"
        )
    order = db.query(Order).options(*_order_load).filter(Order.id == order_id).first()
    if not order or order.brand_id != current_user.id:
        raise HTTPException(status_code=404, detail="Order not found")
    allocated = _allocated_shipping_for_order(order)
    order_items = []
    for idx, item in enumerate(order.items):
        if item.product_variant.product.brand_id != current_user.id:
            continue
        allocated_cost = allocated[idx] if idx < len(allocated) else 0.0
        order_items.append(_build_order_item_response(item, allocated_cost))
    fn, em, ph, addr, city, pc = _order_delivery(order)
    return schemas.OrderResponse(
        id=str(order.id),  # type: ignore
        number=str(order.order_number),  # type: ignore
        total_amount=float(order.total_amount),  # type: ignore
        currency="RUB",
        date=order.created_at,  # type: ignore
        status=order.status.value,
        tracking_number=str(order.tracking_number) if order.tracking_number else None,  # type: ignore
        tracking_link=str(order.tracking_link) if order.tracking_link else None,  # type: ignore
        shipping_cost=order.shipping_cost or 0,
        items=order_items,
        delivery_full_name=fn,
        delivery_email=em,
        delivery_phone=ph,
        delivery_address=addr,
        delivery_city=city,
        delivery_postal_code=pc,
    )


def _is_admin(current_user) -> bool:
    """True if the authenticated principal is the designated admin brand."""
    if not isinstance(current_user, Brand):
        return False
    admin_email = getattr(settings, "ADMIN_EMAIL", None)
    if admin_email and current_user.auth_account and current_user.auth_account.email == admin_email:
        return True
    return False


@app.delete("/api/v1/orders/{order_id}/cancel", response_model=MessageResponse)
async def buyer_cancel_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Buyer cancels their own CREATED (unpaid) order. Stock is restored."""
    if isinstance(current_user, Brand):
        raise HTTPException(status_code=403, detail="Brands cannot cancel buyer orders via this endpoint")
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == str(current_user.id)).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if order.status != OrderStatus.CREATED:
        raise HTTPException(
            status_code=400,
            detail=f"Только неоплаченные заказы можно отменить. Статус заказа: {order.status.value}"
        )
    if order.expires_at and order.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Срок оплаты заказа истёк")
    payment_service.update_order_status(
        db, order_id, OrderStatus.CANCELED,
        actor_type="user", actor_id=str(current_user.id), note="buyer cancelled"
    )
    db.commit()
    return {"message": "Заказ успешно отменён"}


@app.post("/api/v1/admin/orders/{order_id}/cancel", response_model=MessageResponse)
async def admin_cancel_order(
    order_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admin cancels any order regardless of status."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if order.status == OrderStatus.CANCELED:
        raise HTTPException(status_code=400, detail="Заказ уже отменён")
    payment_service.update_order_status(
        db, order_id, OrderStatus.CANCELED,
        actor_type="admin", actor_id=str(current_user.id), note="admin cancelled"
    )
    db.commit()
    return {"message": "Заказ отменён администратором"}


class OrderStatusEventResponse(BaseModel):
    id: str
    from_status: Optional[str]
    to_status: str
    actor_type: str
    actor_id: Optional[str]
    note: Optional[str]
    created_at: datetime


@app.get("/api/v1/orders/{order_id}/history", response_model=List[OrderStatusEventResponse])
async def get_order_status_history(
    order_id: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return status event history for an order. Brand sees own orders; admin sees all."""
    from models import OrderStatusEvent
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    if isinstance(current_user, Brand):
        if order.brand_id != current_user.id and not _is_admin(current_user):
            raise HTTPException(status_code=403, detail="Доступ запрещён")
    else:
        if order.user_id != str(current_user.id):
            raise HTTPException(status_code=403, detail="Доступ запрещён")
    from models import OrderStatusEvent as OSE
    events = db.query(OSE).filter(OSE.order_id == order_id).order_by(OSE.created_at).all()
    return [OrderStatusEventResponse(
        id=str(e.id),
        from_status=e.from_status,
        to_status=e.to_status,
        actor_type=e.actor_type,
        actor_id=e.actor_id,
        note=e.note,
        created_at=e.created_at,
    ) for e in events]


@app.get("/api/v1/checkouts/{checkout_id}", response_model=schemas.CheckoutResponse)
async def get_checkout_by_id(
    checkout_id: str,
    current_user: any = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get full checkout details for the current user (nested orders per brand). Caller must be a user (not a brand)."""
    if isinstance(current_user, Brand):
        raise HTTPException(
            status_code=403,
            detail="Brands must use GET /api/v1/orders/{order_id} for their orders",
        )
    checkout = (
        db.query(Checkout)
        .options(
            joinedload(Checkout.orders)
            .joinedload(Order.items)
            .joinedload(OrderItem.product_variant)
            .joinedload(ProductVariant.color_variant)
            .joinedload(ProductColorVariant.product)
            .joinedload(Product.brand),
        )
        .filter(Checkout.id == checkout_id, Checkout.user_id == str(current_user.id))
        .first()
    )
    if not checkout:
        raise HTTPException(status_code=404, detail="Checkout not found")
    return _checkout_to_full_response(checkout)


@app.post("/api/v1/payments/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle YooKassa payment webhooks"""
    if not payment_service.verify_webhook_ip(
        request.client.host if request.client else None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid IP address"
        )

    request_body = await request.body()
    payload = json.loads(request_body)
    print(f"Webhook payload received: {payload}")
    event = payload.get("event")
    print(f"Webhook event: {event}")
    if event == "payment.succeeded":
        payment = payload.get("object", {})
        order_id = payment.get("metadata", {}).get("order_id")
        print(f"Payment succeeded - Order ID: {order_id}")
        if order_id:
            payment_service.update_order_status(db, order_id, OrderStatus.PAID)
    elif event == "payment.canceled":
        payment = payload.get("object", {})
        order_id = payment.get("metadata", {}).get("order_id")
        print(f"Payment canceled - Order ID: {order_id}")
        if order_id:
            payment_service.update_order_status(db, order_id, OrderStatus.CANCELED)
    db.commit()  # Added commit here
    return {"status": "ok"}


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database on application startup"""
    init_db()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
