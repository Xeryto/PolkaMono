from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, validator, ValidationError
from typing import Optional, List, Literal
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
import re
import json
import time
import uuid
import random
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import our modules
from config import settings
from database import get_db, init_db
from models import User, OAuthAccount, Brand, Style, UserBrand, UserStyle, Gender, FriendRequest, Friendship, FriendRequestStatus, Product, UserLikedProduct, UserSwipe, Category, Order, OrderItem, OrderStatus, ExclusiveAccessEmail, ProductVariant, ProductStyle, UserProfile, UserShippingInfo, UserPreferences, PrivacyOption
from auth_service import auth_service
from oauth_service import oauth_service
import payment_service
import schemas
from schemas import UserCreate, EmailVerificationRequest
from mail_service import mail_service

# Size ordering utility
def get_size_order(size: str) -> int:
    """Get the order index for size sorting (XS to XL)"""
    size_order = {
        "XS": 1,
        "S": 2, 
        "M": 3,
        "L": 4,
        "XL": 5,
        "One Size": 6
    }
    return size_order.get(size, 999)  # Unknown sizes go to the end

def sort_variants_by_size(variants):
    """Sort variants by size order (XS to XL)"""
    return sorted(variants, key=lambda v: get_size_order(v.size))

limiter = Limiter(key_func=get_remote_address)
app = FastAPI(
    title="PolkaAPI - Authentication Backend",
    description="A modern, fast, and secure authentication API with OAuth support for mobile and web applications",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
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

# Security
security = HTTPBearer()

# Pydantic Models


class UserLogin(BaseModel):
    identifier: str  # Can be either email or username
    password: str
    
    @validator('identifier')
    def validate_identifier(cls, v):
        if not v or not v.strip():
            raise ValueError('Identifier cannot be empty')
        return v.strip()
    
    def is_email(self) -> bool:
        """Check if the identifier is an email address"""
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_pattern, self.identifier))
    
    def is_username(self) -> bool:
        """Check if the identifier is a username"""
        # Username pattern: alphanumeric, underscores, hyphens, #, $, !
        username_pattern = r'^[a-zA-Z0-9_\-#$!]+$'
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

class UserSearchResponse(BaseModel):
    id: str
    username: str
    email: str
    avatar_url: Optional[str] = None
    friend_status: Optional[str] = None # 'friend', 'request_received', 'request_sent', 'not_friend'

class PublicUserProfileResponse(BaseModel):
    id: str
    username: str
    gender: Optional[Gender] = None

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
    is_liked: Optional[bool] = None # Only for /for_user endpoint

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
async def get_payment_status(
    payment_id: str,
    db: Session = Depends(get_db)
):
    """Get the status of a payment by its ID and update it from YooKassa"""
    order = db.query(Order).filter(Order.id == payment_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )

    # Fetch real-time status from YooKassa
    yookassa_status = payment_service.get_yookassa_payment_status(order.id)
    if yookassa_status:
        # Update local order status if different
        if order.status.value.lower() != yookassa_status.lower():
            print(f"Updating order {order.id} status from {order.status.value} to {yookassa_status} based on YooKassa.")
            order.status = OrderStatus(yookassa_status.upper()) # Assuming YooKassa status matches OrderStatus enum
            db.commit()
            db.refresh(order)
    else:
        print(f"Could not fetch real-time status for order {order.id} from YooKassa.")

    return PaymentStatusResponse(status=order.status.value)

# Dependency to get current user (can be User or Brand)
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> any: # Return type can be User or Brand
    """Get current user (User or Brand) from JWT token"""
    payload = auth_service.verify_token_payload(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный токен. Пожалуйста, войдите в систему заново."
        )
    
    user_id = payload.get("sub")
    is_brand = payload.get("is_brand", False)

    if is_brand:
        entity = db.query(Brand).filter(Brand.id == user_id).first()
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Бренд не найден. Проверьте правильность учетных данных."
            )
    else:
        entity = auth_service.get_user_by_id(db, user_id)
        if not entity:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Пользователь не найден. Проверьте правильность учетных данных."
            )
    
    return entity

def get_current_brand_user(
    current_user: any = Depends(get_current_user), # current_user can be User or Brand
    db: Session = Depends(get_db)
) -> Brand: # Ensure it returns a Brand
    """Get current brand user from JWT token"""
    # Check if the entity is indeed a Brand instance
    if not isinstance(current_user, Brand):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a brand account"
        )
    return current_user

@app.get("/api/v1/brands/profile", response_model=schemas.BrandResponse)
async def get_brand_profile(
    current_brand_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Get the authenticated brand user's profile"""
    brand = db.query(Brand).filter(Brand.id == int(current_brand_user.id)).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден. Проверьте правильность данных.")
    
    return schemas.BrandResponse(
        id=brand.id,
        name=brand.name,
        email=brand.email,
        slug=brand.slug,
        logo=brand.logo,
        description=brand.description,
        return_policy=brand.return_policy,
        min_free_shipping=brand.min_free_shipping,
        shipping_price=brand.shipping_price,
        shipping_provider=brand.shipping_provider,
        amount_withdrawn=brand.amount_withdrawn,
        created_at=brand.created_at,
        updated_at=brand.updated_at
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
    swipe_direction: Literal["left", "right"]

@app.get("/api/v1/brands/stats", response_model=BrandStatsResponse)
async def get_brand_stats(
    current_brand_user: Brand = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Get statistics for the authenticated brand user"""
    
    # 1. Get total amount sold
    orders_with_brand_products = db.query(Order).join(OrderItem).join(ProductVariant, OrderItem.product_variant_id == ProductVariant.id).join(Product).filter(
        Product.brand_id == current_brand_user.id
    ).distinct().all()

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
        current_balance=current_balance
    )

@app.get("/api/v1/user/stats", response_model=UserStatsResponse)
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get statistics for the authenticated user"""
    
    # Calculate items purchased (from completed orders)
    items_purchased = db.query(func.count(OrderItem.id)).join(Order).filter(
        Order.user_id == current_user.id,
        Order.status == OrderStatus.PAID
    ).scalar() or 0
    
    # Calculate items swiped
    items_swiped = db.query(func.count(UserSwipe.id)).filter(
        UserSwipe.user_id == current_user.id
    ).scalar() or 0
    
    # Calculate total orders (all orders regardless of status)
    total_orders = db.query(func.count(Order.id)).filter(
        Order.user_id == current_user.id
    ).scalar() or 0
    
    # Calculate account age in days
    account_age_days = (datetime.utcnow() - current_user.created_at).days
    
    return UserStatsResponse(
        items_purchased=items_purchased,
        items_swiped=items_swiped,
        total_orders=total_orders,
        account_age_days=account_age_days
    )

@app.post("/api/v1/user/swipe", response_model=MessageResponse)
async def track_user_swipe(
    swipe_data: SwipeTrackingRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Track user swipe on a product"""
    
    # Verify product exists
    product = db.query(Product).filter(Product.id == swipe_data.product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )
    
    # Create swipe record
    user_swipe = UserSwipe(
        user_id=current_user.id,
        product_id=swipe_data.product_id,
        swipe_direction=swipe_data.swipe_direction
    )
    
    db.add(user_swipe)
    db.commit()
    
    return {"message": "Swipe tracked successfully"}

@app.put("/api/v1/brands/profile", response_model=schemas.BrandResponse)
async def update_brand_profile(
    brand_data: schemas.BrandUpdate,
    current_brand_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Update the authenticated brand user's profile"""
    brand = db.query(Brand).filter(Brand.id == int(current_brand_user.id)).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Бренд не найден. Проверьте правильность данных.")
    
    # Update fields
    if brand_data.name is not None:
        brand.name = brand_data.name
    if brand_data.email is not None:
        # Check if new email is already taken by another brand
        if db.query(Brand).filter(Brand.email == brand_data.email, Brand.id != brand.id).first():
            raise HTTPException(status_code=400, detail="Email already registered to another brand")
        brand.email = brand_data.email
    if brand_data.password is not None:
        brand.password_hash = auth_service.hash_password(brand_data.password)
    if brand_data.slug is not None:
        brand.slug = brand_data.slug
    if brand_data.logo is not None:
        brand.logo = brand_data.logo
    if brand_data.description is not None:
        brand.description = brand_data.description
    if brand_data.return_policy is not None:
        brand.return_policy = brand_data.return_policy
    if brand_data.min_free_shipping is not None:
        brand.min_free_shipping = brand_data.min_free_shipping
    if brand_data.shipping_price is not None:
        brand.shipping_price = brand_data.shipping_price
    if brand_data.shipping_provider is not None:
        brand.shipping_provider = brand_data.shipping_provider
    
    brand.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(brand)
    
    return schemas.BrandResponse(
        id=brand.id,
        name=brand.name,
        email=brand.email,
        slug=brand.slug,
        logo=brand.logo,
        description=brand.description,
        return_policy=brand.return_policy,
        min_free_shipping=brand.min_free_shipping,
        shipping_price=brand.shipping_price,
        shipping_provider=brand.shipping_provider,
        created_at=brand.created_at,
        updated_at=brand.updated_at
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


@app.post("/api/v1/auth/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    # Check if user already exists
    if auth_service.get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже существует. Используйте другой email или войдите в систему."
        )
    
    if auth_service.get_user_by_username(db, user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя уже занято. Выберите другое имя пользователя."
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
        avatar_url=user_data.avatar_url
    )

    # Send verification email
    code = auth_service.create_verification_code(db, user)
    mail_service.send_email(
        to_email=user.email,
        subject="Verify your email address",
        html_content=f"Your email verification code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code in the app to verify your email."
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
            email=user.email,
            avatar_url=avatar_url,
            is_active=user.is_active,
            is_email_verified=user.is_email_verified,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
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
            detail="Неверный формат идентификатора. Пожалуйста, введите действительный email или имя пользователя."
        )
    
    if not user or not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные. Проверьте правильность email/имени пользователя и пароля."
        )
    
    if not auth_service.verify_password(user_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль. Проверьте правильность введенного пароля."
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
            email=user.email,
            avatar_url=avatar_url,
            is_active=user.is_active,
            is_email_verified=user.is_email_verified,
            created_at=user.created_at,
            updated_at=user.updated_at
        )
    )

@app.post("/api/v1/auth/oauth/login", response_model=AuthResponse)
async def oauth_login(oauth_data: OAuthLogin, db: Session = Depends(get_db)):
    """Login with OAuth provider"""
    result = await auth_service.handle_oauth_login(db, oauth_data.provider, oauth_data.token)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OAuth token or provider not supported"
        )
    
    return AuthResponse(
        token=result["token"],
        expires_at=result["expires_at"],
        user=schemas.UserProfileResponse(**result["user"])
    )

@app.post("/api/v1/brands/auth/login", response_model=AuthResponse) # Re-use AuthResponse for now, will adjust user field later
async def brand_login(brand_data: schemas.BrandLogin, db: Session = Depends(get_db)):
    """Login brand user with email and password"""
    brand = db.query(Brand).filter(Brand.email == brand_data.email).first()
    
    if not brand or not auth_service.verify_password(brand_data.password, brand.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверные учетные данные бренда. Проверьте правильность email и пароля."
        )
    
    # Create access token for the brand
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_service.create_access_token(
        data={"sub": str(brand.id), "is_brand": True}, expires_delta=access_token_expires
    )
    
    # For now, return a simplified UserResponse for the brand
    # In a real app, you'd have a dedicated BrandAuthResponse or similar
    return AuthResponse(
        token=access_token,
        expires_at=datetime.utcnow() + access_token_expires,
        user=schemas.UserProfileResponse( # Re-using UserProfileResponse, but it's a Brand
            id=str(brand.id), # Convert int ID to string for UserProfileResponse
            username=brand.name, # Use brand name as username
            email=brand.email,
            is_active=True, # Brands are always active for login
            is_email_verified=True, # Assuming brand emails are verified
            is_brand=True,
            created_at=brand.created_at,
            updated_at=brand.updated_at,
            # Brand specific fields
            return_policy=brand.return_policy,
            min_free_shipping=brand.min_free_shipping,
            shipping_price=brand.shipping_price,
            shipping_provider=brand.shipping_provider
        )
    )

@app.post("/api/v1/brands/auth/forgot-password")
@limiter.limit("5/minute")
async def brand_forgot_password(request: Request, forgot_password_request: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Send password reset code to brand email"""
    # Determine if the identifier is an email or brand name
    identifier = forgot_password_request.identifier.strip()
    
    # Check if it's an email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, identifier))
    
    if is_email:
        brand = db.query(Brand).filter(Brand.email == identifier).first()
    else:
        # Treat as brand name
        brand = db.query(Brand).filter(Brand.name == identifier).first()
    
    if not brand:
        # Still return a success message to prevent enumeration
        return {"message": "If a brand account with that email or name exists, a password reset code has been sent."}

    # Create verification code for brand password reset
    code = auth_service.create_verification_code(db, brand)
    mail_service.send_email(
        to_email=brand.email,
        subject="Brand Password Reset Code",
        html_content=f"Your brand password reset code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code to reset your brand password."
    )

    return {"message": "If a brand account with that email or name exists, a password reset code has been sent."}

@app.post("/api/v1/brands/auth/validate-password-reset-code")
async def brand_validate_password_reset_code(validation_request: schemas.ValidatePasswordResetCodeRequest, db: Session = Depends(get_db)):
    """Validate password reset code for brand"""
    identifier = validation_request.identifier.strip()
    
    # Check if it's an email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, identifier))
    
    if is_email:
        brand = db.query(Brand).filter(Brand.email == identifier).first()
    else:
        # Treat as brand name
        brand = db.query(Brand).filter(Brand.name == identifier).first()
    
    if not brand:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")

    if brand.email_verification_code != validation_request.code:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")

    if brand.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")

    return {"message": "Code is valid"}

@app.post("/api/v1/brands/auth/reset-password-with-code")
async def brand_reset_password_with_code(reset_password_request: schemas.ResetPasswordWithCodeRequest, db: Session = Depends(get_db)):
    """Reset brand password using verification code"""
    identifier = reset_password_request.identifier.strip()
    
    # Check if it's an email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, identifier))
    
    if is_email:
        brand = db.query(Brand).filter(Brand.email == identifier).first()
    else:
        # Treat as brand name
        brand = db.query(Brand).filter(Brand.name == identifier).first()
    
    if not brand:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")

    if brand.email_verification_code != reset_password_request.code:
        raise HTTPException(status_code=400, detail="Invalid brand email/name or code")

    if brand.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")

    # Check if new password matches current password or is in password history
    new_password_hash = auth_service.hash_password(reset_password_request.new_password)
    
    # Check if new password is the same as current password
    if brand.password_hash and auth_service.verify_password(reset_password_request.new_password, brand.password_hash):
        raise HTTPException(status_code=400, detail="You cannot reuse your current password")
    
    # Check if new password matches any password in history
    if brand.password_history:
        for historical_hash in brand.password_history:
            if auth_service.verify_password(reset_password_request.new_password, historical_hash):
                raise HTTPException(status_code=400, detail="You cannot reuse a previous password")
    
    # Store current password in history before updating
    # Initialize password_history if it doesn't exist
    if not brand.password_history:
        brand.password_history = []
    
    # Add current password to history (if it exists)
    if brand.password_hash:
        brand.password_history.append(brand.password_hash)
    
    # Keep only last 5 passwords
    if len(brand.password_history) > 5:
        brand.password_history = brand.password_history[-5:]
    
    # Mark password_history as modified for SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(brand, 'password_history')
    
    # Reset the password
    brand.password_hash = new_password_hash
    brand.email_verification_code = None
    brand.email_verification_code_expires_at = None
    db.commit()

    return {"message": "Brand password has been reset successfully."}

@app.get("/api/v1/auth/oauth/providers", response_model=List[OAuthProviderResponse])
async def get_oauth_providers():
    """Get available OAuth providers"""
    providers = []
    
    if settings.GOOGLE_CLIENT_ID:
        providers.append(OAuthProviderResponse(
            provider="google",
            client_id=settings.GOOGLE_CLIENT_ID,
            redirect_url=f"{settings.OAUTH_REDIRECT_URL}/google",
            scope="openid email profile"
        ))
    
    if settings.FACEBOOK_CLIENT_ID:
        providers.append(OAuthProviderResponse(
            provider="facebook",
            client_id=settings.FACEBOOK_CLIENT_ID,
            redirect_url=f"{settings.OAUTH_REDIRECT_URL}/facebook",
            scope="email public_profile"
        ))
    
    if settings.GITHUB_CLIENT_ID:
        providers.append(OAuthProviderResponse(
            provider="github",
            client_id=settings.GITHUB_CLIENT_ID,
            redirect_url=f"{settings.OAUTH_REDIRECT_URL}/github",
            scope="read:user user:email"
        ))
    
    if settings.APPLE_CLIENT_ID:
        providers.append(OAuthProviderResponse(
            provider="apple",
            client_id=settings.APPLE_CLIENT_ID,
            redirect_url=f"{settings.OAUTH_REDIRECT_URL}/apple",
            scope="name email"
        ))
    
    return providers

@app.get("/api/v1/auth/oauth/{provider}/authorize")
async def oauth_authorize(provider: str, request: Request):
    """Redirect to OAuth provider authorization URL"""
    oauth_client = oauth_service.get_oauth_client(provider)
    
    if not oauth_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider not configured"
        )
    
    redirect_uri = f"{settings.OAUTH_REDIRECT_URL}/{provider}"
    authorization_url, state = oauth_client.create_authorization_url(
        redirect_uri=redirect_uri
    )
    
    return RedirectResponse(url=authorization_url)

@app.get("/api/v1/auth/oauth/callback/{provider}")
async def oauth_callback(provider: str, code: str, state: str, db: Session = Depends(get_db)):
    """Handle OAuth callback"""
    oauth_client = oauth_service.get_oauth_client(provider)
    
    if not oauth_client:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OAuth provider not configured"
        )
    
    try:
        redirect_uri = f"{settings.OAUTH_REDIRECT_URL}/{provider}"
        token = oauth_client.fetch_token(
            token_url=oauth_client.token_endpoint,
            authorization_response=f"?code={code}&state={state}",
            redirect_uri=redirect_uri
        )
        
        access_token = token.get('access_token')
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get access token"
            )
        
        result = await auth_service.handle_oauth_login(db, provider, access_token)
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to process OAuth login"
            )
        
        # In a real application, you might want to redirect to a frontend URL
        # with the token as a query parameter or use a more sophisticated approach
        return {
            "token": result["token"],
            "expires_at": result["expires_at"],
            "user": result["user"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth callback failed: {str(e)}"
        )

@app.post("/api/v1/auth/request-verification")
@limiter.limit("5/minute")
async def request_verification(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    code = auth_service.create_verification_code(db, current_user)
    mail_service.send_email(
        to_email=current_user.email,
        subject="Verify your email address",
        html_content=f"Your email verification code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code in the app to verify your email."
    )
    return {"message": "Verification email sent"}

@app.post("/api/v1/auth/verify-email")
async def verify_email(verification_data: schemas.EmailVerificationRequest, db: Session = Depends(get_db)):
    user = auth_service.get_user_by_email(db, verification_data.email)
    if not user:
        raise HTTPException(status_code=400, detail="Invalid email or code")

    if user.email_verification_code != verification_data.code:
        raise HTTPException(status_code=400, detail="Invalid email or code")

    if user.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")

    user.is_email_verified = True
    user.email_verification_code = None
    user.email_verification_code_expires_at = None
    db.commit()

    return {"message": "Email verified successfully"}

@app.post("/api/v1/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, forgot_password_request: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    # Determine if the identifier is an email or username
    identifier = forgot_password_request.identifier.strip()
    
    # Check if it's an email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, identifier))
    
    if is_email:
        user = auth_service.get_user_by_email(db, identifier)
    else:
        # Treat as username
        user = auth_service.get_user_by_username(db, identifier)
    
    if not user:
        # Still return a success message to prevent enumeration
        return {"message": "If an account with that username or email exists, a password reset code has been sent."}

    # Create verification code instead of token for code-based reset
    code = auth_service.create_verification_code(db, user)
    mail_service.send_email(
        to_email=user.email,
        subject="Password Reset Code",
        html_content=f"Your password reset code is: <b>{code}</b>. It will expire in {settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES} minutes. Please enter this code in the app to reset your password."
    )

    return {"message": "If an account with that username or email exists, a password reset code has been sent."}

@app.post("/api/v1/auth/reset-password")
async def reset_password(reset_password_request: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.password_reset_token == reset_password_request.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token")

    if user.password_reset_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token has expired")

    # Check if new password matches current password or is in password history
    new_password_hash = auth_service.hash_password(reset_password_request.new_password)
    
    # Check if new password is the same as current password
    if user.password_hash and auth_service.verify_password(reset_password_request.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="You cannot reuse your current password")
    
    # Check if new password matches any password in history
    if user.password_history:
        for historical_hash in user.password_history:
            if auth_service.verify_password(reset_password_request.new_password, historical_hash):
                raise HTTPException(status_code=400, detail="You cannot reuse a previous password")
    
    # Store current password in history before updating
    # Initialize password_history if it doesn't exist
    if not user.password_history:
        user.password_history = []
    
    # Add current password to history (if it exists)
    if user.password_hash:
        user.password_history.append(user.password_hash)
    
    # Keep only last 5 passwords
    if len(user.password_history) > 5:
        user.password_history = user.password_history[-5:]
    
    # Mark password_history as modified for SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, 'password_history')

    user.password_hash = new_password_hash
    user.password_reset_token = None
    user.password_reset_expires = None
    db.commit()

    return {"message": "Password has been reset successfully."}

@app.post("/api/v1/auth/validate-password-reset-code")
async def validate_password_reset_code(validation_request: schemas.ValidatePasswordResetCodeRequest, db: Session = Depends(get_db)):
    # Determine if the identifier is an email or username
    identifier = validation_request.identifier.strip()
    
    # Check if it's an email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, identifier))
    
    if is_email:
        user = auth_service.get_user_by_email(db, identifier)
    else:
        # Treat as username
        user = auth_service.get_user_by_username(db, identifier)
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")

    if user.email_verification_code != validation_request.code:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")

    if user.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")

    return {"message": "Code is valid"}

@app.post("/api/v1/auth/reset-password-with-code")
async def reset_password_with_code(reset_password_request: schemas.ResetPasswordWithCodeRequest, db: Session = Depends(get_db)):
    # Determine if the identifier is an email or username
    identifier = reset_password_request.identifier.strip()
    
    # Check if it's an email
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    is_email = bool(re.match(email_pattern, identifier))
    
    if is_email:
        user = auth_service.get_user_by_email(db, identifier)
    else:
        # Treat as username
        user = auth_service.get_user_by_username(db, identifier)
    
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")

    if user.email_verification_code != reset_password_request.code:
        raise HTTPException(status_code=400, detail="Invalid username/email or code")

    if user.email_verification_code_expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Verification code has expired")

    # Check if new password matches current password or is in password history
    new_password_hash = auth_service.hash_password(reset_password_request.new_password)
    
    # Check if new password is the same as current password
    if user.password_hash and auth_service.verify_password(reset_password_request.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="You cannot reuse your current password")
    
    # Check if new password matches any password in history
    if user.password_history:
        for historical_hash in user.password_history:
            if auth_service.verify_password(reset_password_request.new_password, historical_hash):
                raise HTTPException(status_code=400, detail="You cannot reuse a previous password")
    
    # Store current password in history before updating
    # Initialize password_history if it doesn't exist
    if not user.password_history:
        user.password_history = []
    
    # Add current password to history (if it exists)
    if user.password_hash:
        user.password_history.append(user.password_hash)
    
    # Keep only last 5 passwords
    if len(user.password_history) > 5:
        user.password_history = user.password_history[-5:]
    
    # Mark password_history as modified for SQLAlchemy
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, 'password_history')
    
    # Reset the password
    user.password_hash = new_password_hash
    user.email_verification_code = None
    user.email_verification_code_expires_at = None
    db.commit()

    return {"message": "Password has been reset successfully."}

@app.post("/api/v1/auth/logout")
async def logout():
    """Logout user (JWT tokens are stateless)"""
    return {"message": "Successfully logged out"}

@app.post("/api/v1/exclusive-access-signup", status_code=status.HTTP_201_CREATED)
async def exclusive_access_signup(signup_data: schemas.ExclusiveAccessSignupRequest, db: Session = Depends(get_db)):
    """Store email for exclusive access signup"""
    existing_email = db.query(ExclusiveAccessEmail).filter(ExclusiveAccessEmail.email == signup_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already signed up for exclusive access"
        )
    
    new_signup = ExclusiveAccessEmail(email=signup_data.email)
    db.add(new_signup)
    db.commit()
    return {"message": "Successfully signed up for exclusive access!"}

@app.get("/api/v1/user/profile", response_model=schemas.UserProfileResponse)
async def get_user_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get current user's complete profile (users only)"""
    # Ensure user_id is treated as a string for database comparison
    user_id = str(current_user.id)
    
    # Get favorite brands and styles
    favorite_brands = db.query(Brand).join(UserBrand).filter(UserBrand.user_id == user_id).all()
    favorite_styles = db.query(Style).join(UserStyle).filter(UserStyle.user_id == user_id).all()
    
    # Get domain-specific data
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    shipping_info = db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
    preferences = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    
    return schemas.UserProfileResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        is_active=current_user.is_active,
        is_email_verified=current_user.is_email_verified,
        is_brand=False,  # Mark as regular user
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        favorite_brands=[schemas.UserBrandResponse(
            id=brand.id,
            name=brand.name,
            slug=brand.slug,
            logo=brand.logo,
            description=brand.description
        ) for brand in favorite_brands],
        favorite_styles=[schemas.StyleResponse(
            id=style.id,
            name=style.name,
            description=style.description
        ) for style in favorite_styles],
        profile=schemas.ProfileResponse(
            full_name=profile.full_name,
            gender=profile.gender.value if profile.gender else None,
            selected_size=profile.selected_size,
            avatar_url=profile.avatar_url
        ) if profile else None,
        shipping_info=schemas.ShippingInfoResponse(
            delivery_email=shipping_info.delivery_email,
            phone=shipping_info.phone,
            street=shipping_info.street,
            house_number=shipping_info.house_number,
            apartment_number=shipping_info.apartment_number,
            city=shipping_info.city,
            postal_code=shipping_info.postal_code
        ) if shipping_info else None,
        preferences=schemas.PreferencesResponse(
            size_privacy=preferences.size_privacy.value if preferences.size_privacy else None,
            recommendations_privacy=preferences.recommendations_privacy.value if preferences.recommendations_privacy else None,
            likes_privacy=preferences.likes_privacy.value if preferences.likes_privacy else None,
            order_notifications=preferences.order_notifications,
            marketing_notifications=preferences.marketing_notifications
        ) if preferences else None
    )

@app.get("/api/v1/brands/profile", response_model=schemas.UserProfileResponse)
async def get_brand_profile(current_user: Brand = Depends(get_current_brand_user), db: Session = Depends(get_db)):
    """Get current brand's complete profile (brands only)"""
    # For brands: Return brand profile in UserProfileResponse format
    # Brands don't have profile/shipping/preferences, so return None for those
    return schemas.UserProfileResponse(
        id=str(current_user.id),  # Convert integer to string
        username=current_user.name,  # Use brand name as username
        email=current_user.email,
        is_active=True,  # Brands are always active
        is_email_verified=True,  # Assuming brand emails are verified
        is_brand=True,  # Mark as brand
        created_at=current_user.created_at,
        updated_at=current_user.updated_at,
        favorite_brands=[],  # Brands don't have favorite brands
        favorite_styles=[],  # Brands don't have favorite styles
        profile=None,  # Brands don't have user profiles
        shipping_info=None,  # Brands don't have shipping info
        preferences=None  # Brands don't have preferences
    )

@app.post("/api/v1/brands/products", response_model=schemas.Product, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_data: schemas.ProductCreateRequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Create a new product for the authenticated brand user"""
    brand = db.query(Brand).filter(Brand.id == product_data.brand_id).first()
    if not brand:
        raise HTTPException(status_code=400, detail="Brand not found")


    # Generate unique article number for the product (Option 5: Brand + Abbreviation + Random)
    def generate_article_number(brand_name: str, product_name: str) -> str:
        """Generate article number: BRAND-ABBREV-RANDOM (e.g., NIKE-AM270-A3B7)"""
        # Brand prefix: First 4-6 uppercase letters
        brand_clean = re.sub(r'[^A-Z0-9]', '', brand_name.upper())
        brand_prefix = brand_clean[:6]
        
        # Remove brand name from product name if present
        product_clean = re.sub(r'\b' + re.escape(brand_name) + r'\b', '', product_name, flags=re.IGNORECASE).strip()
        words = product_clean.split() if product_clean else product_name.split()
        
        # Abbreviation: First letter of each significant word (skip stop words)
        stop_words = {'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with'}
        significant_words = [w for w in words[:5] if w.lower() not in stop_words]
        
        if significant_words:
            # Separate words with numbers from words without
            words_with_numbers = []
            words_without_numbers = []
            
            for word in significant_words[:4]:
                if re.search(r'\d', word):
                    words_with_numbers.append(word)
                else:
                    words_without_numbers.append(word)
            
            abbrev_parts = []
            
            # Take first letter of words WITHOUT numbers (up to 3 words)
            for word in words_without_numbers[:3]:
                first_char = re.sub(r'[^A-Z]', '', word.upper())[0:1]
                if first_char:
                    abbrev_parts.append(first_char)
            
            # Extract numbers from words WITH numbers (preserve full number if possible)
            if words_with_numbers:
                for word in words_with_numbers[:2]:  # Check first 2 words with numbers
                    number_match = re.search(r'\d+', word)
                    if number_match:
                        number_str = number_match.group(0)[:3]  # Max 3 digits
                        abbrev_parts.append(number_str)
                        break  # Only use first number found
            
            product_abbrev = ''.join(abbrev_parts)[:5]  # Cap at 5 characters total
        else:
            product_abbrev = re.sub(r'[^A-Z0-9]', '', product_name.upper())[:5]
        
        if len(product_abbrev) < 2:
            product_abbrev = re.sub(r'[^A-Z0-9]', '', product_name.upper())[:5] or "PRD"
        
        # Random suffix: 4 characters (excludes ambiguous: 0, O, 1, I, L)
        random_chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        random_suffix = ''.join(random.choices(random_chars, k=4))
        
        return f"{brand_prefix}-{product_abbrev}-{random_suffix}"
    
    # Generate unique article number (handle collisions)
    article_number = None
    max_attempts = 10
    for attempt in range(max_attempts):
        candidate_article = generate_article_number(brand.name, product_data.name)
        existing = db.query(Product).filter(Product.article_number == candidate_article).first()
        if not existing:
            article_number = candidate_article
            break
        # On collision, modify random suffix
        if attempt < max_attempts - 1:
            random_chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
            candidate_article = candidate_article[:-4] + ''.join(random.choices(random_chars, k=4))
    
    if not article_number:
        # Fallback: use UUID-based (extremely unlikely to need this)
        product_id_preview = str(uuid.uuid4())[:8].upper()
        random_chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        brand_prefix = re.sub(r'[^A-Z0-9]', '', brand.name.upper())[:6]
        article_number = f"{brand_prefix}-{product_id_preview[:4]}-{''.join(random.choices(random_chars, k=4))}"
    
    # Create product
    product = Product(
        name=product_data.name,
        description=product_data.description,
        price=product_data.price,
        images=product_data.images,
        color=product_data.color,
        material=product_data.material,
        article_number=article_number,
        brand_id=product_data.brand_id,
        category_id=product_data.category_id
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # Add variants
    for variant_data in product_data.variants:
        variant = ProductVariant(
            product_id=product.id,
            size=variant_data.size,
            stock_quantity=variant_data.stock_quantity
        )
        db.add(variant)
    db.commit()
    db.refresh(product)

    # Add styles
    for style_id in product_data.styles:
        style = db.query(Style).filter(Style.id == style_id).first()
        if not style:
            raise HTTPException(status_code=400, detail=f"Style with ID {style_id} not found")
        product_style = ProductStyle(product_id=product.id, style_id=style_id)
        db.add(product_style)
    db.commit()
    db.refresh(product)

    return schemas.Product(
        id=product.id,
        name=product.name,
        description=product.description,
        price=product.price,
        images=product.images,
        color=product.color,
        material=product.material,
        article_number=product.article_number,
        brand_id=product.brand_id,
        category_id=product.category_id,
        styles=[ps.style_id for ps in product.styles],
        variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
        brand_name=brand.name,
        brand_return_policy=brand.return_policy
    )

@app.put("/api/v1/brands/products/{product_id}", response_model=schemas.Product)
async def update_product(
    product_id: str,
    product_data: schemas.ProductUpdateRequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Update an existing product for the authenticated brand user"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден. Возможно, он был удален или перемещен.")

    # Ensure the product belongs to the current brand user (if applicable)
    brand = db.query(Brand).filter(Brand.id == product.brand_id).first()
    if not brand:
        raise HTTPException(status_code=400, detail="Brand not found for this product")


    # Update product fields
    for field, value in product_data.dict(exclude_unset=True).items():
        if field == "variants":
            # Handle variants separately
            db.query(ProductVariant).filter(ProductVariant.product_id == product.id).delete()
            for variant_data in value:
                variant = ProductVariant(
                    product_id=product.id,
                    size=variant_data["size"],
                    stock_quantity=variant_data["stock_quantity"]
                )
                db.add(variant)
        elif field == "styles":
            # Handle styles separately
            db.query(ProductStyle).filter(ProductStyle.product_id == product.id).delete()
            for style_id in value:
                style = db.query(Style).filter(Style.id == style_id).first()
                if not style:
                    raise HTTPException(status_code=400, detail=f"Style with ID {style_id} not found")
                product_style = ProductStyle(product_id=product.id, style_id=style_id)
                db.add(product_style)
        elif field == "images":
            product.images = value
        elif field == "color":
            product.color = value
        elif field == "material":
            product.material = value
        elif field not in ["sku"]: # Exclude sku as it's only for order items
            setattr(product, field, value)

    db.commit()
    db.refresh(product)

    return schemas.Product(
        id=product.id,
        name=product.name,
        description=product.description,
        price=product.price,
        images=product.images,
        color=product.color,
        material=product.material,
        article_number=product.article_number,
        brand_id=product.brand_id,
        category_id=product.category_id,
        styles=[ps.style_id for ps in product.styles],
        variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
        brand_name=brand.name,
        brand_return_policy=brand.return_policy
    )

@app.get("/api/v1/brands/products", response_model=List[schemas.Product])
async def get_brand_products(
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Get all products for the authenticated brand user"""
    products = db.query(Product).filter(Product.brand_id == current_user.id).all()

    response_products = []
    for product in products:
        response_products.append(schemas.Product(
            id=product.id,
            name=product.name,
            description=product.description,
            price=product.price,
            images=product.images, # Use images field
            color=product.color,
            material=product.material,
            article_number=product.article_number,
            brand_id=product.brand_id,
            category_id=product.category_id,
            styles=[ps.style_id for ps in product.styles],
            variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
            brand_name=product.brand.name,
            brand_return_policy=product.brand.return_policy
        ))
    return response_products

@app.get("/api/v1/brands/products/{product_id}", response_model=schemas.Product)
async def get_brand_product_details(
    product_id: str,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific product for the authenticated brand user"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден. Возможно, он был удален или перемещен.")

    if product.brand_id != current_user.id:
        raise HTTPException(status_code=403, detail="Product does not belong to your brand")

    return schemas.Product(
        id=product.id,
        name=product.name,
        description=product.description,
        price=product.price,
        images=product.images,
        color=product.color,
        material=product.material,
        article_number=product.article_number,
        brand_id=product.brand_id,
        category_id=product.category_id,
        styles=[ps.style_id for ps in product.styles],
        variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
        brand_name=product.brand.name,
        brand_return_policy=product.brand.return_policy
    )

    


@app.put("/api/v1/brands/orders/{order_id}/tracking", response_model=MessageResponse)
async def update_order_tracking(
    order_id: str,
    tracking_data: schemas.UpdateTrackingRequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Update tracking number for a specific order belonging to the authenticated brand user"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден. Проверьте правильность номера заказа.")

    # Verify that the order belongs to a product from the current brand user
    # This logic needs to be refined based on how brands are linked to orders.
    # For now, assuming brand_id = 1 for testing.
    brand_id_filter = 1 # Placeholder: replace with actual brand_id from current_user
    
    # Check if any item in the order belongs to the current brand
    order_belongs_to_brand = db.query(OrderItem).join(ProductVariant).join(Product).filter(
        OrderItem.order_id == order_id,
        Product.brand_id == brand_id_filter
    ).first()

    if not order_belongs_to_brand:
        raise HTTPException(status_code=403, detail="Order does not belong to your brand")

    if tracking_data.tracking_number is not None:
        order.tracking_number = tracking_data.tracking_number
    if tracking_data.tracking_link is not None:
        order.tracking_link = tracking_data.tracking_link
    db.commit()
    return {"message": "Tracking information updated successfully"}

class UpdateOrderItemSKURequest(BaseModel):
    sku: str

@app.put("/api/v1/brands/order-items/{order_item_id}/sku", response_model=MessageResponse)
async def update_order_item_sku(
    order_item_id: str,
    sku_data: UpdateOrderItemSKURequest,
    current_user: User = Depends(get_current_brand_user),
    db: Session = Depends(get_db)
):
    """Update SKU for a specific order item belonging to the authenticated brand user"""
    order_item = db.query(OrderItem).filter(OrderItem.id == order_item_id).first()
    if not order_item:
        raise HTTPException(status_code=404, detail="Order item not found")

    # Verify that the order item belongs to a product from the current brand user
    brand_id_filter = current_user.id
    
    product = db.query(Product).join(ProductVariant).filter(
        ProductVariant.id == order_item.product_variant_id,
        Product.brand_id == brand_id_filter
    ).first()

    if not product:
        raise HTTPException(status_code=403, detail="Order item does not belong to your brand")

    if order_item.sku:
        raise HTTPException(status_code=400, detail="SKU already assigned and cannot be changed.")

    order_item.sku = sku_data.sku
    db.commit()
    return {"message": "SKU updated successfully"}

@app.get("/api/v1/user/profile/completion-status")
async def get_profile_completion_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Check user profile completion status"""
    missing_fields = []
    required_screens = []
    
    is_gender_complete = current_user.profile.gender is not None if current_user.profile else False
    user_id = str(current_user.id)
    is_brands_complete = db.query(UserBrand).filter(UserBrand.user_id == user_id).count() > 0
    is_styles_complete = db.query(UserStyle).filter(UserStyle.user_id == user_id).count() > 0
    
    is_complete = is_gender_complete and is_brands_complete and is_styles_complete
    
    if not is_gender_complete:
        missing_fields.append('gender')
        required_screens.append('confirmation') # Assuming a screen for gender selection
    if not is_brands_complete:
        missing_fields.append('favorite_brands')
        required_screens.append('brand_selection') # Assuming a screen for brand selection
    if not is_styles_complete:
        missing_fields.append('favorite_styles')
        required_screens.append('style_selection') # Assuming a screen for style selection
    
    return {
        "isComplete": is_complete,
        "missingFields": missing_fields,
        "requiredScreens": required_screens
    }

@app.get("/api/v1/user/oauth-accounts")
async def get_oauth_accounts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get user's OAuth accounts"""
    oauth_accounts = db.query(OAuthAccount).filter(OAuthAccount.user_id == current_user.id).all()
    
    return [
        {
            "id": account.id,
            "provider": account.provider,
            "provider_user_id": account.provider_user_id,
            "created_at": account.created_at,
            "updated_at": account.updated_at
        }
        for account in oauth_accounts
    ]

# Enhanced User Profile Management
@app.put("/api/v1/user/profile", response_model=schemas.UserProfileResponse)
async def update_user_profile(
    profile_data: schemas.UserProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user core information (username/email only)"""
    # Update user fields only
    if profile_data.username is not None:
        current_user.username = profile_data.username
    if profile_data.email is not None:
        current_user.email = profile_data.email
    
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    
    # Return updated profile using get_user_profile logic
    return await get_user_profile(current_user, db)

@app.put("/api/v1/user/profile/data", response_model=schemas.ProfileResponse)
async def update_user_profile_data(
    profile_data: schemas.ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
    
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    
    return schemas.ProfileResponse(
        full_name=profile.full_name,
        gender=profile.gender.value if profile.gender else None,
        selected_size=profile.selected_size,
        avatar_url=profile.avatar_url
    )

@app.put("/api/v1/user/shipping", response_model=schemas.ShippingInfoResponse)
async def update_user_shipping_info(
    shipping_data: schemas.ShippingInfoUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user shipping/delivery information"""
    user_id = str(current_user.id)
    
    # Get or create shipping info
    shipping_info = db.query(UserShippingInfo).filter(UserShippingInfo.user_id == user_id).first()
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
    
    shipping_info.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(shipping_info)
    
    return schemas.ShippingInfoResponse(
        delivery_email=shipping_info.delivery_email,
        phone=shipping_info.phone,
        street=shipping_info.street,
        house_number=shipping_info.house_number,
        apartment_number=shipping_info.apartment_number,
        city=shipping_info.city,
        postal_code=shipping_info.postal_code
    )

@app.put("/api/v1/user/preferences", response_model=schemas.PreferencesResponse)
async def update_user_preferences(
    preferences_data: schemas.PreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update user preferences (privacy and notifications)"""
    user_id = str(current_user.id)
    
    # Get or create preferences
    preferences = db.query(UserPreferences).filter(UserPreferences.user_id == user_id).first()
    if not preferences:
        preferences = UserPreferences(user_id=user_id)
        db.add(preferences)
    
    # Update preference fields
    if preferences_data.size_privacy is not None:
        preferences.size_privacy = PrivacyOption(preferences_data.size_privacy)
    if preferences_data.recommendations_privacy is not None:
        preferences.recommendations_privacy = PrivacyOption(preferences_data.recommendations_privacy)
    if preferences_data.likes_privacy is not None:
        preferences.likes_privacy = PrivacyOption(preferences_data.likes_privacy)
    if preferences_data.order_notifications is not None:
        preferences.order_notifications = preferences_data.order_notifications
    if preferences_data.marketing_notifications is not None:
        preferences.marketing_notifications = preferences_data.marketing_notifications
    
    preferences.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(preferences)
    
    return schemas.PreferencesResponse(
        size_privacy=preferences.size_privacy.value if preferences.size_privacy else None,
        recommendations_privacy=preferences.recommendations_privacy.value if preferences.recommendations_privacy else None,
        likes_privacy=preferences.likes_privacy.value if preferences.likes_privacy else None,
        order_notifications=preferences.order_notifications,
        marketing_notifications=preferences.marketing_notifications
    )

# Brand Management
@app.get("/api/v1/brands", response_model=List[BrandResponse])
async def get_brands(db: Session = Depends(get_db)):
    """Get all available brands"""
    brands = db.query(Brand).all()
    return [
        BrandResponse(
            id=brand.id,
            name=brand.name,
            slug=brand.slug,
            logo=brand.logo,
            description=brand.description
        ) for brand in brands
    ]

@app.post("/api/v1/user/brands")
async def update_user_brands(
    brands_data: UserBrandsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
                detail=f"Brand with ID {brand_id} not found"
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
            id=style.id,
            name=style.name,
            description=style.description
        ) for style in styles
    ]

@app.post("/api/v1/user/styles")
async def update_user_styles(
    styles_data: UserStylesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
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
                detail=f"Style with ID {style_id} not found"
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
            id=category.id,
            name=category.name,
            description=category.description
        ) for category in categories
    ]

# Liking Items Endpoint
@app.post("/api/v1/user/favorites/toggle", response_model=MessageResponse)
async def toggle_favorite_item(
    toggle_data: ToggleFavoriteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add or remove an item from the user's favorites (liked items)"""
    product_id = toggle_data.product_id
    action = toggle_data.action

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    existing_like = db.query(UserLikedProduct).filter(
        UserLikedProduct.user_id == current_user.id,
        UserLikedProduct.product_id == product_id
    ).first()

    if action == "like":
        if existing_like:
            return {"message": "Item already liked."}
        else:
            user_liked_product = UserLikedProduct(
                user_id=current_user.id,
                product_id=product_id
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all products liked by the current user"""
    liked_products = db.query(Product).join(UserLikedProduct).join(Brand).filter(
        UserLikedProduct.user_id == current_user.id
    ).all()

    results = []
    for product in liked_products:
        results.append(schemas.Product(
            id=product.id,
            name=product.name,
            description=product.description,
            price=product.price,
            images=product.images,
            color=product.color,
            material=product.material,
            article_number=product.article_number,
            brand_id=product.brand_id,
            category_id=product.category_id,
            styles=[ps.style_id for ps in product.styles],
            variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
            brand_name=product.brand.name,
            brand_return_policy=product.brand.return_policy,
            is_liked=True
        ))
    return results

# Item Recommendations Endpoints
@app.get("/api/v1/recommendations/for_user", response_model=List[schemas.Product])
async def get_recommendations_for_user(
    limit: int = 5, # Default to 5 products
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Provide recommended items for the current user"""
    # This is a placeholder for a real recommendation engine.
    # For now, return a few random products and mark if liked by the user
    all_products = db.query(Product).join(Brand).order_by(func.random()).limit(limit).all() # Get random products
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    recommendations = []
    for product in all_products:
        recommendations.append(schemas.Product(
            id=product.id,
            name=product.name,
            description=product.description,
            price=product.price,
            images=product.images,
            color=product.color,
            material=product.material,
            article_number=product.article_number,
            brand_id=product.brand_id,
            category_id=product.category_id,
            styles=[ps.style_id for ps in product.styles],
            variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
            brand_name=product.brand.name,
            brand_return_policy=product.brand.return_policy,
            is_liked=product.id in liked_product_ids
        ))
    return recommendations

@app.get("/api/v1/recommendations/for_friend/{friend_id}", response_model=List[schemas.Product])
async def get_recommendations_for_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Provide recommended items for a specific friend"""
    friend_user = db.query(User).filter(User.id == friend_id).first()
    if not friend_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend not found."
        )

    all_products = db.query(Product).join(Brand).order_by(func.random()).limit(8).all() # Get 8 random products
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    recommendations = []
    for product in all_products:
        recommendations.append(schemas.Product(
            id=product.id,
            name=product.name,
            description=product.description,
            price=product.price,
            images=product.images,
            color=product.color,
            material=product.material,
            article_number=product.article_number,
            brand_id=product.brand_id,
            category_id=product.category_id,
            styles=[ps.style_id for ps in product.styles],
            variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
            brand_name=product.brand.name,
            brand_return_policy=product.brand.return_policy,
            is_liked=product.id in liked_product_ids
        ))
    return recommendations

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
    db: Session = Depends(get_db)
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
    products = db.query(Product).join(Brand).order_by(
        Product.purchase_count.desc(),
        Product.created_at.desc()  # Secondary sort by creation date for consistency
    ).limit(limit).all()
    
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}
    
    results = []
    for product in products:
        results.append(schemas.Product(
            id=product.id,
            name=product.name,
            description=product.description,
            price=product.price,
            images=product.images,
            color=product.color,
            material=product.material,
            article_number=product.article_number,
            brand_id=product.brand_id,
            category_id=product.category_id,
            styles=[ps.style_id for ps in product.styles],
            variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
            brand_name=product.brand.name,
            brand_return_policy=product.brand.return_policy,
            is_liked=product.id in liked_product_ids
        ))
    
    # Update cache
    _popular_items_cache = results
    _popular_items_cache_time = current_time
    
    return results

@app.get("/api/v1/products/search", response_model=List[schemas.Product])
async def search_products(
    query: Optional[str] = None,
    category: Optional[str] = None,
    brand: Optional[str] = None,
    style: Optional[str] = None,
    limit: int = 16,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for products based on query and filters"""
    products_query = db.query(Product).join(Brand)

    # Apply search query
    if query:
        search_pattern = f"%{query}%"
        products_query = products_query.filter(
            (Product.name.ilike(search_pattern)) |
            (Product.description.ilike(search_pattern)) |
            (Product.article_number.ilike(search_pattern))  # Search by article number
        )

    # Apply filters
    if category and category != "Категория":
        products_query = products_query.filter(Product.category_id == category)

    if brand and brand != "Бренд":
        products_query = products_query.filter(Brand.name.ilike(f"%{brand}%"))

    if style and style != "Стиль":
        products_query = products_query.join(ProductStyle).join(Style).filter(Style.name.ilike(f"%{style}%"))

    # Apply pagination - use distinct() to prevent duplicate products when filtering by style
    products_query = products_query.distinct().offset(offset).limit(limit)

    products = products_query.all()
    liked_product_ids = {ulp.product_id for ulp in current_user.liked_products}

    results = []
    for product in products:
        results.append(schemas.Product(
            id=product.id,
            name=product.name,
            description=product.description,
            price=product.price,
            images=product.images,
            color=product.color,
            material=product.material,
            article_number=product.article_number,
            brand_id=product.brand_id,
            category_id=product.category_id,
            styles=[ps.style_id for ps in product.styles],
            variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
            brand_name=product.brand.name,
            brand_return_policy=product.brand.return_policy,
            is_liked=product.id in liked_product_ids
        ))
    return results

@app.get("/api/v1/products/{product_id}", response_model=schemas.Product)
async def get_product_details(
    product_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get details of a specific product for regular users"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден. Возможно, он был удален или перемещен.")

    # Check if user has liked this product
    is_liked = any(ulp.product_id == product.id for ulp in current_user.liked_products)

    return schemas.Product(
        id=product.id,
        name=product.name,
        description=product.description,
        price=product.price,
        images=product.images,
        color=product.color,
        material=product.material,
        article_number=product.article_number,
        brand_id=product.brand_id,
        category_id=product.category_id,
        styles=[ps.style_id for ps in product.styles],
        variants=[schemas.ProductVariantSchema(size=v.size, stock_quantity=v.stock_quantity) for v in sort_variants_by_size(product.variants)],
        brand_name=product.brand.name,
        brand_return_policy=product.brand.return_policy,
        is_liked=is_liked
    )

# Friend System Endpoints
@app.post("/api/v1/friends/request", response_model=MessageResponse)
async def send_friend_request(
    request_data: FriendRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a friend request to another user"""
    # Find recipient by username or email
    recipient = None
    if '@' in request_data.recipient_identifier:
        recipient = db.query(User).filter(User.email == request_data.recipient_identifier).first()
    else:
        recipient = db.query(User).filter(User.username == request_data.recipient_identifier).first()
    
    if not recipient:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    if recipient.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send friend request to yourself"
        )
    
    # Check if already friends
    existing_friendship = db.query(Friendship).filter(
        ((Friendship.user_id == current_user.id) & (Friendship.friend_id == recipient.id)) |
        ((Friendship.user_id == recipient.id) & (Friendship.friend_id == current_user.id))
    ).first()
    
    if existing_friendship:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already friends"
        )
    
    # Check if friend request already exists
    existing_request = db.query(FriendRequest).filter(
        ((FriendRequest.sender_id == current_user.id) & (FriendRequest.recipient_id == recipient.id)) |
        ((FriendRequest.sender_id == recipient.id) & (FriendRequest.recipient_id == current_user.id))
    ).first()
    
    if existing_request:
        if existing_request.status == FriendRequestStatus.PENDING:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Friend request already pending"
            )
    
    # Create new friend request
    friend_request = FriendRequest(
        sender_id=current_user.id,
        recipient_id=recipient.id,
        status=FriendRequestStatus.PENDING
    )
    
    db.add(friend_request)
    db.commit()
    
    return {"message": "Friend request sent."}

@app.get("/api/v1/friends/requests/sent", response_model=List[FriendRequestResponse])
async def get_sent_friend_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sent friend requests"""
    requests = db.query(FriendRequest).filter(
        FriendRequest.sender_id == current_user.id
    ).all()
    
    return [
        {
            "id": req.id,
            "recipient": {
                "id": req.recipient.id,
                "username": req.recipient.username
            },
            "status": req.status
        }
        for req in requests
    ]

@app.get("/api/v1/friends/requests/received", response_model=List[ReceivedFriendRequestResponse])
async def get_received_friend_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get received friend requests"""
    requests = db.query(FriendRequest).filter(
        FriendRequest.recipient_id == current_user.id,
        FriendRequest.status == FriendRequestStatus.PENDING
    ).all()
    
    return [
        {
            "id": req.id,
            "sender": {
                "id": req.sender.id,
                "username": req.sender.username
            },
            "status": req.status
        }
        for req in requests
    ]

@app.post("/api/v1/friends/requests/{request_id}/accept", response_model=MessageResponse)
async def accept_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Accept a friend request"""
    friend_request = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        FriendRequest.recipient_id == current_user.id,
        FriendRequest.status == FriendRequestStatus.PENDING
    ).first()
    
    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found or not pending"
        )
    
    # Update request status
    friend_request.status = FriendRequestStatus.ACCEPTED
    friend_request.updated_at = datetime.utcnow()
    
    # Create friendship
    friendship = Friendship(
        user_id=friend_request.sender_id,
        friend_id=friend_request.recipient_id
    )
    
    db.add(friendship)
    db.delete(friend_request) # Delete the friend request after acceptance
    db.commit()
    
    return {"message": "Friend request accepted."}

@app.post("/api/v1/friends/requests/{request_id}/reject", response_model=MessageResponse)
async def reject_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a friend request"""
    friend_request = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        FriendRequest.recipient_id == current_user.id,
        FriendRequest.status == FriendRequestStatus.PENDING
    ).first()
    
    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found or not pending"
        )
    
    friend_request.status = FriendRequestStatus.REJECTED
    friend_request.updated_at = datetime.utcnow()
    db.delete(friend_request) # Delete the friend request after rejection
    db.commit()
    
    return {"message": "Friend request rejected."}

@app.delete("/api/v1/friends/requests/{request_id}/cancel", response_model=MessageResponse)
async def cancel_friend_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a sent friend request"""
    friend_request = db.query(FriendRequest).filter(
        FriendRequest.id == request_id,
        FriendRequest.sender_id == current_user.id,
        FriendRequest.status == FriendRequestStatus.PENDING
    ).first()
    
    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friend request not found or not pending"
        )
    
    friend_request.status = FriendRequestStatus.CANCELLED
    friend_request.updated_at = datetime.utcnow()
    db.delete(friend_request) # Delete the friend request after cancellation
    db.commit()
    
    return {"message": "Friend request cancelled."}

@app.get("/api/v1/friends", response_model=List[FriendResponse])
async def get_friends_list(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's friends list"""
    # Get friendships where current user is either user or friend
    friendships = db.query(Friendship).filter(
        (Friendship.user_id == current_user.id) | (Friendship.friend_id == current_user.id)
    ).all()
    
    friends = []
    for friendship in friendships:
        if friendship.user_id == current_user.id:
            friend_user = db.query(User).filter(User.id == friendship.friend_id).first()
        else:
            friend_user = db.query(User).filter(User.id == friendship.user_id).first()
        
        if friend_user:
            friends.append({
                "id": friend_user.id,
                "username": friend_user.username
            })
    
    return friends

@app.delete("/api/v1/friends/{friend_id}", response_model=MessageResponse)
async def remove_friend(
    friend_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a friend"""
    # Find the friendship entry
    friendship = db.query(Friendship).filter(
        ((Friendship.user_id == current_user.id) & (Friendship.friend_id == friend_id)) |
        ((Friendship.user_id == friend_id) & (Friendship.friend_id == current_user.id))
    ).first()

    if not friendship:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Friendship not found"
        )

    db.delete(friendship)
    db.commit()

    return {"message": "Friend removed successfully"}

@app.get("/api/v1/users/search", response_model=List[UserSearchResponse])
async def search_users(
    query: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search for users by username or email"""
    if len(query) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Search query must be at least 2 characters"
        )
    
    # Search by username or email (case insensitive)
    users = db.query(User).filter(
        (User.username.ilike(f"%{query}%") | User.email.ilike(f"%{query}%")) &
        (User.id != current_user.id)  # Exclude current user
    ).limit(20).all()
    
    result = []
    for user in users:
        friend_status = 'not_friend'
        
        # Check if already friends
        existing_friendship = db.query(Friendship).filter(
            ((Friendship.user_id == current_user.id) & (Friendship.friend_id == user.id)) |
            ((Friendship.user_id == user.id) & (Friendship.friend_id == current_user.id))
        ).first()
        
        if existing_friendship:
            friend_status = 'friend'
        else:
            # Check for pending friend requests
            sent_request = db.query(FriendRequest).filter(
                FriendRequest.sender_id == current_user.id,
                FriendRequest.recipient_id == user.id,
                FriendRequest.status == FriendRequestStatus.PENDING
            ).first()
            
            received_request = db.query(FriendRequest).filter(
                FriendRequest.sender_id == user.id,
                FriendRequest.recipient_id == current_user.id,
                FriendRequest.status == FriendRequestStatus.PENDING
            ).first()
            
            if sent_request:
                friend_status = 'request_sent'
            elif received_request:
                friend_status = 'request_received'
        
        avatar_url = user.profile.avatar_url if user.profile else None
        result.append({
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "avatar_url": avatar_url,
            "friend_status": friend_status
        })
    
    return result

@app.get("/api/v1/users/{user_id}/profile", response_model=PublicUserProfileResponse)
async def get_public_user_profile(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get public profile of another user"""
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    gender = user.profile.gender.value if user.profile and user.profile.gender else None
    return {
        "id": user.id,
        "username": user.username,
        "gender": gender
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
            "apple" if settings.APPLE_CLIENT_ID else None
        ]
    }

@app.post("/api/v1/payments/create", response_model=PaymentCreateResponse)
async def create_payment_endpoint(
    payment_data: schemas.PaymentCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    print("Entered create_payment_endpoint")
    print(f"Request headers: {request.headers}")
    try:
        raw_request_body = await request.body()
        print(f"Raw incoming request body for /api/v1/payments/create: {raw_request_body.decode()}")

        # This line is where Pydantic validation happens implicitly
        # payment_data = schemas.PaymentCreate.parse_raw(raw_request_body) # This is handled by FastAPI automatically

        confirmation_url = payment_service.create_payment(
            db=db,
            user_id=current_user.id,
            amount=payment_data.amount.value,
            currency=payment_data.amount.currency,
            description=payment_data.description,
            return_url=payment_data.returnUrl,
            items=payment_data.items
        )
        #print(f"Receipt data sent to payment_service: {payment_data.receipt.dict() if payment_data.receipt else None}")
        return PaymentCreateResponse(confirmation_url=confirmation_url)
    except ValidationError as e:
        print(f"Pydantic Validation Error: {e.errors()}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=e.errors()
        )
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@app.get("/api/v1/orders", response_model=List[schemas.OrderResponse])
async def get_orders(
    current_user: any = Depends(get_current_user), # current_user can be User or Brand
    db: Session = Depends(get_db)
):
    """Get all orders for the current user or brand"""
    
    # Check if current_user is a Brand or User
    is_brand = isinstance(current_user, Brand)
    
    if is_brand:
        # For brands: Get orders containing products from this brand
        orders_with_brand_products = db.query(Order).join(OrderItem).join(
            ProductVariant, OrderItem.product_variant_id == ProductVariant.id
        ).join(Product).filter(
            Product.brand_id == current_user.id
        ).distinct().all()
        
        response = []
        for order in orders_with_brand_products:
            order_items = []
            for item in order.items:
                # Only include items from this brand
                if item.product_variant.product.brand_id == current_user.id:
                    product_variant = item.product_variant
                    product = product_variant.product
                    
                    order_items.append(schemas.OrderItemResponse(
                        id=item.id,
                        name=product.name,
                        price=item.price,
                        size=product_variant.size,
                        image=product.images[0] if product.images and len(product.images) > 0 else None,
                        delivery=schemas.Delivery(
                            cost=350.0, # Placeholder
                            estimatedTime="1-3 дня", # Placeholder
                            tracking_number=order.tracking_number
                        ),
                        sku=item.sku,  # SKU from OrderItem (renamed from honest_sign)
                        # Additional product details for main page compatibility
                        brand_name=product.brand.name if product.brand else None,
                        description=product.description,
                        color=product.color,
                        materials=product.material,
                        images=product.images if product.images else [],
                        return_policy=product.brand.return_policy if product.brand else None,
                        product_id=product.id  # Original product ID for swipe tracking
                    ))
            
            # Only add order if it contains items from this brand
            if order_items:
                response.append(schemas.OrderResponse(
                    id=order.id,
                    number=order.order_number,
                    total_amount=order.total_amount,
                    currency="RUB",
                    date=order.created_at.isoformat(),
                    status=order.status.value,
                    tracking_number=order.tracking_number,
                    tracking_link=order.tracking_link,
                    items=order_items,
                    # Include delivery information stored at order creation time
                    delivery_full_name=order.delivery_full_name,
                    delivery_email=order.delivery_email,
                    delivery_phone=order.delivery_phone,
                    delivery_address=order.delivery_address,
                    delivery_city=order.delivery_city,
                    delivery_postal_code=order.delivery_postal_code
                ))
        return response
    
    else:
        # For regular users: Get orders placed by this user
        orders = db.query(Order).filter(Order.user_id == str(current_user.id)).all()
        
        response = []
        for order in orders:
            order_items = []
            for item in order.items:
                # Access product details via product_variant relationship
                product_variant = item.product_variant
                product = product_variant.product

                order_items.append(schemas.OrderItemResponse(
                    id=item.id,
                    name=product.name,
                    price=item.price,
                    size=product_variant.size,
                    image=product.images[0] if product.images and len(product.images) > 0 else None,
                    delivery=schemas.Delivery(
                        cost=350.0, # Placeholder
                        estimatedTime="1-3 дня", # Placeholder
                        tracking_number=order.tracking_number # Use order's tracking number
                    ),
                    sku=item.sku,  # SKU from OrderItem (renamed from honest_sign)
                    # Additional product details for main page compatibility
                    brand_name=product.brand.name if product.brand else None,
                    description=product.description,
                    color=product.color,
                    materials=product.material,
                    images=product.images if product.images else [],
                    return_policy=product.brand.return_policy if product.brand else None,
                    product_id=product.id  # Original product ID for swipe tracking
                ))

            response.append(schemas.OrderResponse(
                id=order.id,
                number=order.order_number,
                total_amount=order.total_amount,
                currency="RUB", # Assuming RUB as default currency
                date=order.created_at.isoformat(),
                status=order.status.value,
                tracking_number=order.tracking_number,
                tracking_link=order.tracking_link,
                items=order_items,
                # Include delivery information stored at order creation time
                delivery_full_name=order.delivery_full_name,
                delivery_email=order.delivery_email,
                delivery_phone=order.delivery_phone,
                delivery_address=order.delivery_address,
                delivery_city=order.delivery_city,
                delivery_postal_code=order.delivery_postal_code
            ))
        return response


@app.post("/api/v1/payments/webhook")
async def payment_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle YooKassa payment webhooks"""
    if not payment_service.verify_webhook_ip(request.client.host):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid IP address"
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
    db.commit() # Added commit here
    return {"status": "ok"}


# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    """Initialize database on application startup"""
    init_db()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)