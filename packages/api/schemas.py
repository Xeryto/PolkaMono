import re
from datetime import datetime
from typing import Any, List, Optional

from config import settings  # Import settings
from models import Gender  # Import enums
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator, validator


class Amount(BaseModel):
    value: float
    currency: str


class Customer(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    @model_validator(mode="after")
    def check_at_least_one_contact(self):
        if self.email is None and self.phone is None:
            raise ValueError(
                "At least one of email or phone must be provided for the customer."
            )
        return self


class CartItem(BaseModel):
    product_variant_id: str  # Identifies color + size (ProductVariant.id)
    quantity: int = 1


class PaymentCreate(BaseModel):
    amount: Amount
    description: str
    returnUrl: str
    items: List[CartItem]

    @validator("returnUrl")
    def validate_return_url(cls, v):
        if ":://" not in v:
            raise ValueError("returnUrl must be a valid URL containing ://")
        return v


class OrderTestCreate(BaseModel):
    """Request body for test order creation (no payment gateway)."""

    amount: Amount
    description: str
    items: List[CartItem]


class OrderTestCreateResponse(BaseModel):
    order_id: str


class Delivery(BaseModel):
    cost: float
    estimatedTime: str
    tracking_number: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: str
    name: str
    price: float
    size: str
    image: Optional[str] = None
    delivery: Delivery
    sku: Optional[str] = None  # Stock Keeping Unit - renamed from honest_sign
    # Additional product details for main page compatibility
    brand_name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    materials: Optional[str] = None
    images: Optional[List[str]] = None
    return_policy: Optional[str] = None  # Brand's return policy
    product_id: Optional[str] = None  # Original product ID for swipe tracking

    class Config:
        from_attributes = True


class UpdateTrackingRequest(BaseModel):
    tracking_number: Optional[str] = None  # Make optional for partial updates
    tracking_link: Optional[str] = None  # NEW


# Order status: canonical values returned by API (lowercase).
# Must stay in sync with OrderStatus enum in models.py and frontend/mobile libs.
ORDER_STATUS_VALUES = ("created", "pending", "paid", "shipped", "returned", "partially_returned", "canceled")


class OrderSummaryResponse(BaseModel):
    """Lightweight order for list view (no items or delivery details)."""

    id: str
    number: str
    total_amount: float
    currency: str
    date: datetime
    status: str  # One of: created, pending, paid, shipped, returned, partially_returned, canceled
    tracking_number: Optional[str] = None
    tracking_link: Optional[str] = None
    shipping_cost: float = 0.0

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: str
    number: str
    total_amount: float
    currency: str
    date: datetime
    status: str
    tracking_number: Optional[str] = None
    tracking_link: Optional[str] = None
    shipping_cost: float = (
        0.0  # Order-level shipping (per brand); do not sum item delivery.cost
    )
    items: List[OrderItemResponse]
    delivery_full_name: Optional[str] = None
    delivery_email: Optional[str] = None
    delivery_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_postal_code: Optional[str] = None

    class Config:
        from_attributes = True


class OrderPartResponse(BaseModel):
    """One brand's order within a checkout (for CheckoutResponse)."""

    id: str
    number: str
    brand_id: str
    brand_name: Optional[str] = None
    brand_is_inactive: bool = False
    subtotal: float
    shipping_cost: float
    total_amount: float
    status: str
    tracking_number: Optional[str] = None
    tracking_link: Optional[str] = None
    items: List[OrderItemResponse]


class CheckoutResponse(BaseModel):
    """Full checkout (Ozon-style) with nested orders per brand."""

    id: str
    total_amount: float
    currency: str
    date: datetime
    orders: List[OrderPartResponse]
    delivery_full_name: Optional[str] = None
    delivery_email: Optional[str] = None
    delivery_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_postal_code: Optional[str] = None

    class Config:
        from_attributes = True


class ForgotPasswordRequest(BaseModel):
    identifier: str  # Can be either email or username


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @validator("new_password")
    def validate_new_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
            )
        if " " in v:
            raise ValueError("Password cannot contain spaces")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers")
        return v


class ResetPasswordWithCodeRequest(BaseModel):
    identifier: str  # Can be either email or username
    code: str
    new_password: str

    @validator("new_password")
    def validate_new_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
            )
        if " " in v:
            raise ValueError("Password cannot contain spaces")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers")
        return v


class ValidatePasswordResetCodeRequest(BaseModel):
    identifier: str  # Can be either email or username
    code: str


class EmailVerificationRequest(BaseModel):
    email: EmailStr
    code: str


class ExclusiveAccessSignupRequest(BaseModel):
    email: EmailStr


class ProductVariantSchema(BaseModel):
    id: Optional[str] = None  # Set in API response for cart/order
    size: str
    stock_quantity: int

    @validator("stock_quantity")
    def validate_stock_quantity(cls, v):
        if v < 0:
            raise ValueError("Stock quantity cannot be negative")
        return v

    class Config:
        from_attributes = True


class ProductColorVariantSchema(BaseModel):
    id: Optional[str] = None
    color_name: str
    color_hex: str
    images: List[str] = []
    variants: List[ProductVariantSchema] = []

    class Config:
        from_attributes = True


class ProductColorVariantCreate(BaseModel):
    color_name: str = Field(..., max_length=50)
    color_hex: str = Field(..., max_length=50)
    images: List[str] = []
    variants: List[ProductVariantSchema]


class ProductCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    price: float
    brand_id: str
    category_id: str = Field(..., max_length=50)
    styles: Optional[List[str]] = []
    color_variants: List[ProductColorVariantCreate]
    material: Optional[str] = Field(None, max_length=100)
    country_of_manufacture: Optional[str] = Field(None, max_length=100)
    article_number: Optional[str] = Field(
        None, max_length=50
    )  # Auto-generated if not provided
    general_images: Optional[List[str]] = None
    delivery_time_min: Optional[int] = None  # per-product override
    delivery_time_max: Optional[int] = None
    sale_price: Optional[float] = None
    sale_type: Optional[str] = Field(None, pattern=r"^(percent|exact)$")
    sizing_table_image: Optional[str] = None

    @field_validator("price", mode="before")
    @classmethod
    def validate_price(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Цена должна быть больше нуля")
        return v

    @field_validator("sale_price", mode="before")
    @classmethod
    def validate_sale_price(cls, v):
        if v is not None and v <= 0:
            raise ValueError("Цена со скидкой должна быть больше нуля")
        return v

    @model_validator(mode="after")
    def require_at_least_one_image(self):
        has_general = self.general_images and len(self.general_images) > 0
        has_one_per_color = self.color_variants and all(
            cv.images and len(cv.images) > 0 for cv in self.color_variants
        )
        if not has_general and not has_one_per_color:
            raise ValueError(
                "At least one image is required: add general_images and/or at least one image per color variant."
            )
        if self.delivery_time_min is not None and self.delivery_time_max is not None:
            if self.delivery_time_max < self.delivery_time_min:
                raise ValueError("Максимальный срок доставки должен быть не меньше минимального")
        if self.sale_price is not None and self.sale_type is None:
            raise ValueError("sale_type обязателен при указании sale_price")
        return self


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    price: Optional[float] = None
    brand_id: Optional[str] = None
    category_id: Optional[str] = Field(None, max_length=50)
    styles: Optional[List[str]] = None
    color_variants: Optional[List[ProductColorVariantCreate]] = None
    material: Optional[str] = Field(None, max_length=100)
    country_of_manufacture: Optional[str] = Field(None, max_length=100)
    general_images: Optional[List[str]] = None
    delivery_time_min: Optional[int] = None
    delivery_time_max: Optional[int] = None
    sale_price: Optional[float] = None
    sale_type: Optional[str] = Field(None, pattern=r"^(percent|exact)$")
    sizing_table_image: Optional[str] = None

    @model_validator(mode="after")
    def require_at_least_one_image_if_provided(self):
        # Only validate if BOTH general_images and color_variants are provided in the update.
        # For partial updates, we cannot validate without knowing the existing product state.
        if self.general_images is not None and self.color_variants is not None:
            has_general = self.general_images and len(self.general_images) > 0
            has_one_per_color = self.color_variants and all(
                cv.images and len(cv.images) > 0 for cv in self.color_variants
            )
            if not has_general and not has_one_per_color:
                raise ValueError(
                    "At least one image is required: add general_images and/or at least one image per color variant."
                )
        if self.delivery_time_min is not None and self.delivery_time_max is not None:
            if self.delivery_time_max < self.delivery_time_min:
                raise ValueError("Максимальный срок доставки должен быть не меньше минимального")
        if self.sale_price is not None and self.sale_type is None:
            raise ValueError("sale_type обязателен при указании sale_price")
        return self


class Product(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    brand_id: str
    category_id: str
    styles: List[str] = []
    color_variants: List[ProductColorVariantSchema] = []
    description: Optional[str] = None
    material: Optional[str] = None
    country_of_manufacture: Optional[str] = None
    article_number: Optional[str] = None
    brand_name: Optional[str] = None
    brand_return_policy: Optional[str] = None
    is_liked: Optional[bool] = None
    general_images: List[str] = []
    delivery_time_min: Optional[int] = None
    delivery_time_max: Optional[int] = None
    sale_price: Optional[float] = None
    sale_type: Optional[str] = None
    sizing_table_image: Optional[str] = None

    class Config:
        from_attributes = True


# User core update (username/email only)
class UserProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None


# Profile data schemas
class ProfileUpdateRequest(BaseModel):
    full_name: Optional[str] = Field(None, max_length=255)
    gender: Optional[str] = None
    selected_size: Optional[str] = Field(None, max_length=10)
    avatar_url: Optional[str] = Field(None, max_length=500)
    avatar_url_full: Optional[str] = Field(None, max_length=500)
    avatar_crop: Optional[str] = Field(None, max_length=1000)
    avatar_transform: Optional[str] = Field(None, max_length=500)


class ProfileResponse(BaseModel):
    full_name: Optional[str] = None
    gender: Optional[str] = None
    selected_size: Optional[str] = None
    avatar_url: Optional[str] = None
    avatar_url_full: Optional[str] = None
    avatar_crop: Optional[str] = None
    avatar_transform: Optional[str] = None

    class Config:
        from_attributes = True


# Shipping info schemas
class ShippingInfoUpdateRequest(BaseModel):
    delivery_email: Optional[EmailStr] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    street: Optional[str] = Field(None, max_length=255)
    house_number: Optional[str] = Field(None, max_length=50)
    apartment_number: Optional[str] = Field(None, max_length=50)
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)

    @validator("phone")
    def validate_phone(cls, v):
        if v is None:
            return v
        # Russian phone format: +7 followed by 10 digits (total 12 characters with +)
        # Accept formats: +7XXXXXXXXXX or 7XXXXXXXXXX (we'll normalize to +7)
        v = v.strip()
        if not v:
            return v
        # Remove spaces, dashes, parentheses
        cleaned = re.sub(r"[\s\-\(\)]", "", v)
        # If starts with 8, replace with +7
        if cleaned.startswith("8"):
            cleaned = "+7" + cleaned[1:]
        # If starts with 7 but not +7, add +
        elif cleaned.startswith("7") and not cleaned.startswith("+7"):
            cleaned = "+" + cleaned
        # If doesn't start with +7, add it
        elif not cleaned.startswith("+7"):
            cleaned = "+7" + cleaned
        # Validate format: +7 followed by exactly 10 digits
        if not re.match(r"^\+7\d{10}$", cleaned):
            raise ValueError(
                "Phone number must be a valid Russian phone number (+7 followed by 10 digits)"
            )
        return cleaned

    @validator("postal_code")
    def validate_postal_code(cls, v):
        if v is None:
            return v
        # Russian postal codes are 6 digits
        v = v.strip()
        if not v:
            return v
        # Remove spaces and dashes
        cleaned = re.sub(r"[\s\-]", "", v)
        if not re.match(r"^\d{6}$", cleaned):
            raise ValueError("Postal code must be 6 digits (Russian format)")
        return cleaned


class ShippingInfoResponse(BaseModel):
    delivery_email: Optional[str] = None
    phone: Optional[str] = None
    street: Optional[str] = None
    house_number: Optional[str] = None
    apartment_number: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None

    class Config:
        from_attributes = True


# Preferences schemas
class PreferencesUpdateRequest(BaseModel):
    size_privacy: Optional[str] = None
    recommendations_privacy: Optional[str] = None
    likes_privacy: Optional[str] = None
    order_notifications: Optional[bool] = None
    marketing_notifications: Optional[bool] = None


class PreferencesResponse(BaseModel):
    size_privacy: Optional[str] = None
    recommendations_privacy: Optional[str] = None
    likes_privacy: Optional[str] = None
    order_notifications: bool = True
    marketing_notifications: bool = True

    class Config:
        from_attributes = True


class StyleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserBrandResponse(BaseModel):
    id: str
    name: str
    slug: str
    logo: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class UserProfileResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    is_active: bool
    is_email_verified: bool
    is_brand: bool = False
    created_at: datetime
    updated_at: datetime
    favorite_brands: Optional[List[UserBrandResponse]] = []
    favorite_styles: Optional[List[StyleResponse]] = []
    # Domain-specific data
    profile: Optional[ProfileResponse] = None
    shipping_info: Optional[ShippingInfoResponse] = None
    preferences: Optional[PreferencesResponse] = None

    class Config:
        from_attributes = True


class BrandCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    slug: str
    logo: Optional[str] = None
    description: Optional[str] = None
    return_policy: Optional[str] = None
    min_free_shipping: Optional[int] = None
    shipping_price: Optional[float] = None
    shipping_provider: Optional[str] = None


class BrandLogin(BaseModel):
    email: EmailStr
    password: str


class BrandUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None
    password: Optional[str] = None  # For changing password
    slug: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = Field(None, max_length=1000)
    return_policy: Optional[str] = None
    min_free_shipping: Optional[int] = None
    shipping_price: Optional[float] = None
    shipping_provider: Optional[str] = None
    inn: Optional[str] = None
    registration_address: Optional[str] = None
    payout_account: Optional[str] = Field(None, max_length=100)
    payout_account_locked: Optional[bool] = None
    delivery_time_min: Optional[int] = None  # days
    delivery_time_max: Optional[int] = None  # days

    @field_validator("inn", mode="before")
    @classmethod
    def validate_inn(cls, v):
        if v is None:
            return v
        cleaned = re.sub(r"\s", "", str(v))
        if not re.match(r"^\d{10}$|^\d{12}$", cleaned):
            raise ValueError("ИНН должен содержать 10 или 12 цифр")
        return cleaned

    @field_validator("shipping_price", mode="before")
    @classmethod
    def validate_shipping_price(cls, v):
        if v is not None and v < 0:
            raise ValueError("Цена доставки не может быть отрицательной")
        return v

    @field_validator("min_free_shipping", mode="before")
    @classmethod
    def validate_min_free_shipping(cls, v):
        if v is not None and v < 0:
            raise ValueError("Минимальная цена для бесплатной доставки не может быть отрицательной")
        return v

    @field_validator("delivery_time_min", "delivery_time_max", mode="before")
    @classmethod
    def validate_delivery_times(cls, v):
        if v is not None and v < 1:
            raise ValueError("Срок доставки должен быть не менее 1 дня")
        return v

    @model_validator(mode="after")
    def check_delivery_time_range(self):
        if self.delivery_time_min is not None and self.delivery_time_max is not None:
            if self.delivery_time_max < self.delivery_time_min:
                raise ValueError("Максимальный срок доставки должен быть не меньше минимального")
        return self


class BrandResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    slug: str
    logo: Optional[str] = None
    description: Optional[str] = None
    return_policy: Optional[str] = None
    min_free_shipping: Optional[int] = None
    shipping_price: Optional[float] = None
    shipping_provider: Optional[str] = None
    amount_withdrawn: float = 0.0
    inn: Optional[str] = None
    registration_address: Optional[str] = None
    payout_account: Optional[str] = None
    payout_account_locked: bool = False
    delivery_time_min: Optional[int] = None
    delivery_time_max: Optional[int] = None
    is_inactive: bool = False
    scheduled_deletion_at: Optional[datetime] = None
    two_factor_enabled: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    gender: Optional[Gender] = None
    selected_size: Optional[str] = None
    avatar_url: Optional[str] = None

    @validator("username")
    def validate_username(cls, v):
        if len(v) < settings.MIN_USERNAME_LENGTH:
            raise ValueError(
                f"Username must be at least {settings.MIN_USERNAME_LENGTH} characters"
            )
        if " " in v:
            raise ValueError("Username cannot contain spaces")
        if (
            not v.replace("_", "")
            .replace("-", "")
            .replace("#", "")
            .replace("$", "")
            .replace("!", "")
            .isalnum()
        ):
            raise ValueError("Username contains invalid characters")
        return v

    @validator("password")
    def validate_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
            )
        if " " in v:
            raise ValueError("Password cannot contain spaces")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers")
        return v


class PresignedUploadRequest(BaseModel):
    """Request a presigned URL for direct S3 upload (avatar or product image)."""

    content_type: str = Field(..., description="e.g. image/jpeg, image/png")
    filename: Optional[str] = Field(
        None, description="Optional original filename for extension"
    )


class PresignedUploadResponse(BaseModel):
    upload_url: str
    public_url: str
    key: str


# -- Phase 7: Account Management + 2FA --

class BrandChangePassword(BaseModel):
    current_password: str
    new_password: str

    @validator("new_password")
    def validate_new_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(
                f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters"
            )
        if " " in v:
            raise ValueError("Password cannot contain spaces")
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError("Password must contain both letters and numbers")
        return v


class Brand2FAConfirm(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class Brand2FADisable(BaseModel):
    password: str  # Requires password re-entry to disable 2FA


class BrandInactiveToggle(BaseModel):
    is_inactive: bool


class BrandDeleteResponse(BaseModel):
    message: str
    scheduled_deletion_at: datetime


class Brand2FAStatusResponse(BaseModel):
    two_factor_enabled: bool
    pending_confirmation: bool  # True if OTP was sent but not yet confirmed


class BrandLoginResponse(BaseModel):
    """Returned by brand login. If otp_required=True, token is absent — client must call /2fa/verify."""
    token: Optional[str] = None
    expires_at: Optional[datetime] = None
    user: Optional[Any] = None  # UserProfileResponse when login is complete
    otp_required: bool = False
    session_token: Optional[str] = None  # secrets.token_hex(32) — stored in AuthAccount.otp_session_token


class BrandVerifyOTP(BaseModel):
    session_token: str  # Random hex token from the 202 login response
    code: str = Field(min_length=6, max_length=6)


class BrandResendOTP(BaseModel):
    session_token: str  # Random hex token from the 202 login response


class NotificationItem(BaseModel):
    id: str
    type: str
    message: str
    order_id: Optional[str] = None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationsResponse(BaseModel):
    notifications: List[NotificationItem]
    unread_count: int


class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: datetime


class AdminReturnItem(BaseModel):
    item_id: str
    order_id: str
    product_name: str
    brand_name: str
    returned_at: Optional[datetime] = None


class AdminReturnLog(BaseModel):
    items: List[AdminReturnItem]


class AdminOrderLookupResponse(BaseModel):
    order_id: str
    brand_name: str
    items: List[dict]  # {item_id, product_name, quantity, current_status}


class AdminLogReturnRequest(BaseModel):
    order_id: str
    item_ids: List[str]
