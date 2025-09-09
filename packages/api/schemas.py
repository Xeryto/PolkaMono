from pydantic import BaseModel, EmailStr, validator, model_validator
from typing import List, Optional
from datetime import datetime
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
    image: str
    delivery: Delivery

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

    class Config:
        from_attributes = True

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class EmailVerificationRequest(BaseModel):
    email: EmailStr
    code: str

class ExclusiveAccessSignupRequest(BaseModel):
    email: EmailStr

class ProductVariantSchema(BaseModel):
    size: str
    stock_quantity: int

class ProductCreateRequest(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    images: List[str] = [] # New field for multiple image URLs
    brand_id: int
    category_id: str
    styles: Optional[List[str]] = []
    variants: List[ProductVariantSchema]
    sku: Optional[str] = None # NEW

class ProductUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    images: Optional[List[str]] = None # New field for multiple image URLs
    brand_id: Optional[int] = None
    category_id: Optional[str] = None
    styles: Optional[List[str]] = None
    variants: Optional[List[ProductVariantSchema]] = None
    sku: Optional[str] = None # NEW

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
    sku: Optional[str] = None
    brand_name: Optional[str] = None
    brand_return_policy: Optional[str] = None
    is_liked: Optional[bool] = None

    class Config:
        from_attributes = True

class UserProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    selected_size: Optional[str] = None
    avatar_url: Optional[str] = None

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
    created_at: datetime
    updated_at: datetime

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