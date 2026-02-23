import re
from datetime import datetime
from typing import List, Optional

from config import settings  # Import settings
from models import Gender  # Import enums
from pydantic import BaseModel, EmailStr, Field, model_validator, validator


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
ORDER_STATUS_VALUES = ("pending", "paid", "shipped", "returned", "canceled")


class OrderSummaryResponse(BaseModel):
    """Lightweight order for list view (no items or delivery details)."""

    id: str
    number: str
    total_amount: float
    currency: str
    date: datetime
    status: str  # One of: pending, paid, shipped, returned, canceled
    tracking_number: Optional[str] = None
    tracking_link: Optional[str] = None

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
    brand_id: int
    brand_name: Optional[str] = None
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


class ResetPasswordWithCodeRequest(BaseModel):
    identifier: str  # Can be either email or username
    code: str
    new_password: str


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
    brand_id: int
    category_id: str = Field(..., max_length=50)
    styles: Optional[List[str]] = []
    color_variants: List[ProductColorVariantCreate]
    material: Optional[str] = Field(None, max_length=100)
    article_number: Optional[str] = Field(
        None, max_length=50
    )  # Auto-generated if not provided
    general_images: Optional[List[str]] = None

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
        return self


class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    price: Optional[float] = None
    brand_id: Optional[int] = None
    category_id: Optional[str] = Field(None, max_length=50)
    styles: Optional[List[str]] = None
    color_variants: Optional[List[ProductColorVariantCreate]] = None
    material: Optional[str] = Field(None, max_length=100)
    general_images: Optional[List[str]] = None

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
        return self


class Product(BaseModel):
    id: Optional[str] = None
    name: str
    price: float
    brand_id: int
    category_id: str
    styles: List[str] = []
    color_variants: List[ProductColorVariantSchema] = []
    description: Optional[str] = None
    material: Optional[str] = None
    article_number: Optional[str] = None
    brand_name: Optional[str] = None
    brand_return_policy: Optional[str] = None
    is_liked: Optional[bool] = None
    general_images: List[str] = []

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
    id: int
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
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None  # For changing password
    slug: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    return_policy: Optional[str] = None
    min_free_shipping: Optional[int] = None
    shipping_price: Optional[float] = None
    shipping_provider: Optional[str] = None
    inn: Optional[str] = None
    registration_address: Optional[str] = None
    payout_account: Optional[str] = None
    payout_account_locked: Optional[bool] = None


class BrandResponse(BaseModel):
    id: int
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
