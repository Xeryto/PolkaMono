from pydantic import BaseModel, EmailStr, validator, model_validator, Field
from typing import List, Optional
from datetime import datetime
import re
from models import Gender # Import Gender enum
from config import settings # Import settings

class Amount(BaseModel):
    value: float
    currency: str

class Customer(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    @model_validator(mode='after')
    def check_at_least_one_contact(self):
        if self.email is None and self.phone is None:
            raise ValueError('At least one of email or phone must be provided for the customer.')
        return self

class CartItem(BaseModel):
    product_id: str
    quantity: int = 1
    size: str

class PaymentCreate(BaseModel):
    amount: Amount
    description: str
    returnUrl: str
    items: List[CartItem]

    @validator('returnUrl')
    def validate_return_url(cls, v):
        if ":://" not in v:
            raise ValueError('returnUrl must be a valid URL containing ://')
        return v

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
    tracking_number: Optional[str] = None # Make optional for partial updates
    tracking_link: Optional[str] = None # NEW

class OrderResponse(BaseModel):
    id: str
    number: str
    total_amount: float
    currency: str
    date: datetime
    status: str
    tracking_number: Optional[str] = None
    tracking_link: Optional[str] = None # NEW
    items: List[OrderItemResponse]
    
    # Delivery information stored at order creation time
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
    size: str
    stock_quantity: int
    
    @validator('stock_quantity')
    def validate_stock_quantity(cls, v):
        if v < 0:
            raise ValueError('Stock quantity cannot be negative')
        return v

class ProductCreateRequest(BaseModel):
    name: str = Field(..., max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    price: float
    images: List[str] = [] # New field for multiple image URLs
    brand_id: int
    category_id: str = Field(..., max_length=50)
    styles: Optional[List[str]] = []
    variants: List[ProductVariantSchema]
    color: Optional[str] = Field(None, max_length=50)
    material: Optional[str] = Field(None, max_length=100)
    article_number: Optional[str] = Field(None, max_length=50)  # Will be auto-generated if not provided

class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = Field(None, max_length=1000)
    price: Optional[float] = None
    images: Optional[List[str]] = None # New field for multiple image URLs
    brand_id: Optional[int] = None
    category_id: Optional[str] = Field(None, max_length=50)
    styles: Optional[List[str]] = None
    variants: Optional[List[ProductVariantSchema]] = None
    color: Optional[str] = Field(None, max_length=50)
    material: Optional[str] = Field(None, max_length=100)

class Product(BaseModel):
    id: Optional[str]
    name: str
    price: float
    images: List[str] = []
    brand_id: int
    category_id: str
    styles: List[str] = []
    variants: List[ProductVariantSchema] = []
    description: Optional[str] = None
    color: Optional[str] = None
    material: Optional[str] = None
    article_number: Optional[str] = None  # User-facing article number for search and sharing
    brand_name: Optional[str] = None
    brand_return_policy: Optional[str] = None
    is_liked: Optional[bool] = None

    class Config:
        from_attributes = True

class UserProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    selected_size: Optional[str] = Field(None, max_length=10)
    avatar_url: Optional[str] = Field(None, max_length=500)
    # Shopping information fields
    full_name: Optional[str] = Field(None, max_length=255)
    delivery_email: Optional[EmailStr] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None  # Text field, no explicit length limit
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    
    @validator('phone')
    def validate_phone(cls, v):
        if v is None:
            return v
        # Russian phone format: +7 followed by 10 digits (total 12 characters with +)
        # Accept formats: +7XXXXXXXXXX or 7XXXXXXXXXX (we'll normalize to +7)
        v = v.strip()
        if not v:
            return v
        # Remove spaces, dashes, parentheses
        cleaned = re.sub(r'[\s\-\(\)]', '', v)
        # If starts with 8, replace with +7
        if cleaned.startswith('8'):
            cleaned = '+7' + cleaned[1:]
        # If starts with 7 but not +7, add +
        elif cleaned.startswith('7') and not cleaned.startswith('+7'):
            cleaned = '+' + cleaned
        # If doesn't start with +7, add it
        elif not cleaned.startswith('+7'):
            cleaned = '+7' + cleaned
        # Validate format: +7 followed by exactly 10 digits
        if not re.match(r'^\+7\d{10}$', cleaned):
            raise ValueError('Phone number must be a valid Russian phone number (+7 followed by 10 digits)')
        return cleaned
    
    @validator('postal_code')
    def validate_postal_code(cls, v):
        if v is None:
            return v
        # Russian postal codes are 6 digits
        v = v.strip()
        if not v:
            return v
        # Remove spaces and dashes
        cleaned = re.sub(r'[\s\-]', '', v)
        if not re.match(r'^\d{6}$', cleaned):
            raise ValueError('Postal code must be 6 digits (Russian format)')
        return cleaned

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
    gender: Optional[str] = None
    selected_size: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool
    is_email_verified: bool
    is_brand: bool = False
    # Shopping information fields
    full_name: Optional[str] = None
    delivery_email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    favorite_brands: Optional[List[UserBrandResponse]] = []
    favorite_styles: Optional[List[StyleResponse]] = []

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
    password: Optional[str] = None # For changing password
    slug: Optional[str] = None
    logo: Optional[str] = None
    description: Optional[str] = None
    return_policy: Optional[str] = None
    min_free_shipping: Optional[int] = None
    shipping_price: Optional[float] = None
    shipping_provider: Optional[str] = None

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
    
    @validator('username')
    def validate_username(cls, v):
        if len(v) < settings.MIN_USERNAME_LENGTH:
            raise ValueError(f'Username must be at least {settings.MIN_USERNAME_LENGTH} characters')
        if ' ' in v:
            raise ValueError('Username cannot contain spaces')
        if not v.replace('_', '').replace('-', '').replace('#', '').replace('$', '').replace('!', '').isalnum():
            raise ValueError('Username contains invalid characters')
        return v
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(f'Password must be at least {settings.MIN_PASSWORD_LENGTH} characters')
        if ' ' in v:
            raise ValueError('Password cannot contain spaces')
        if not any(c.isalpha() for c in v) or not any(c.isdigit() for c in v):
            raise ValueError('Password must contain both letters and numbers')
        return v