"""
Configuration settings for PolkaAPI
"""
import os
from typing import List, Optional
from functools import lru_cache
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings:
    """Application settings"""
    
    # Environment
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = os.getenv("PROJECT_NAME", "PolkaAPI - Authentication Backend")
    VERSION: str = os.getenv("VERSION", "1.0.0")
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES: int = int(os.getenv("EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES", "10"))
    ORDER_PENDING_EXPIRY_HOURS: int = int(os.getenv("ORDER_PENDING_EXPIRY_HOURS", "24"))
    
    # Database Configuration
    DATABASE_URL: str = os.getenv("DATABASE_URL")
    
    @property
    def get_database_url(self) -> str:
        """Get database URL from environment variable"""
        if not self.DATABASE_URL:
            raise ValueError("DATABASE_URL environment variable must be set")
        return self.DATABASE_URL
    
    # CORS - Environment-specific origins
    @property
    def get_cors_origins(self) -> List[str]:
        """Get CORS origins based on environment"""
        cors_origins_env = os.getenv("BACKEND_CORS_ORIGINS")
        if cors_origins_env:
            return [origin.strip() for origin in cors_origins_env.split(",")]
            
    
    @property
    def BACKEND_CORS_ORIGINS(self) -> List[str]:
        """Get CORS origins for FastAPI middleware"""
        return self.get_cors_origins
    
    # OAuth Configuration
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = os.getenv("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET: Optional[str] = os.getenv("GOOGLE_CLIENT_SECRET")
    GOOGLE_DISCOVERY_URL: str = "https://accounts.google.com/.well-known/openid_configuration"
    
    # Facebook OAuth
    FACEBOOK_CLIENT_ID: Optional[str] = os.getenv("FACEBOOK_CLIENT_ID")
    FACEBOOK_CLIENT_SECRET: Optional[str] = os.getenv("FACEBOOK_CLIENT_SECRET")
    
    # GitHub OAuth
    GITHUB_CLIENT_ID: Optional[str] = os.getenv("GITHUB_CLIENT_ID")
    GITHUB_CLIENT_SECRET: Optional[str] = os.getenv("GITHUB_CLIENT_SECRET")
    
    # Apple OAuth
    APPLE_CLIENT_ID: Optional[str] = os.getenv("APPLE_CLIENT_ID")
    APPLE_CLIENT_SECRET: Optional[str] = os.getenv("APPLE_CLIENT_SECRET")
    APPLE_TEAM_ID: Optional[str] = os.getenv("APPLE_TEAM_ID")
    APPLE_KEY_ID: Optional[str] = os.getenv("APPLE_KEY_ID")
    APPLE_PRIVATE_KEY: Optional[str] = os.getenv("APPLE_PRIVATE_KEY")
    
    # OAuth Redirect URLs
    OAUTH_REDIRECT_URL: str = os.getenv("OAUTH_REDIRECT_URL")
    
    # Validation Rules
    MIN_USERNAME_LENGTH: int = 3
    MIN_PASSWORD_LENGTH: int = 6
    MAX_USERNAME_LENGTH: int = 50
    MAX_EMAIL_LENGTH: int = 255
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO" if ENVIRONMENT == "production" else "DEBUG")
    
    # Validation
    @classmethod
    def validate_config(cls) -> bool:
        """Validate configuration settings"""
        try:
            settings = cls()
            
            # Check required environment variables
            required_vars = ["DATABASE_URL", "SECRET_KEY", "OAUTH_REDIRECT_URL"]
            
            for var in required_vars:
                if not os.getenv(var):
                    print(f"ERROR: {var} environment variable is required")
                    return False
            
            # Validate database URL
            settings.get_database_url  # This will raise an error if DATABASE_URL is not set
            
            print(f"Configuration validated successfully for {settings.ENVIRONMENT} environment")
            return True
            
        except Exception as e:
            print(f"Configuration validation failed: {e}")
            return False

    # YooKassa
    YOOKASSA_SHOP_ID: Optional[str] = os.getenv("YOOKASSA_SHOP_ID")
    YOOKASSA_SECRET_KEY: Optional[str] = os.getenv("YOOKASSA_SECRET_KEY")

    # UniSender
    UNISENDER_API_KEY: Optional[str] = os.getenv("UNISENDER_API_KEY")
    UNISENDER_FROM_EMAIL: Optional[str] = os.getenv("UNISENDER_FROM_EMAIL")
    UNISENDER_FROM_NAME: Optional[str] = os.getenv("UNISENDER_FROM_NAME")
    UNISENDER_LIST_ID: Optional[str] = os.getenv("UNISENDER_LIST_ID")

    # Admin
    ADMIN_EMAIL: Optional[str] = os.getenv("ADMIN_EMAIL")

    # AWS S3 (images: avatars, product images)
    AWS_ACCESS_KEY_ID: Optional[str] = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = os.getenv("AWS_SECRET_ACCESS_KEY")
    AWS_REGION: str = os.getenv("AWS_REGION", "us-east-1")
    S3_BUCKET_NAME: Optional[str] = os.getenv("S3_BUCKET_NAME")
    # Optional: CloudFront or custom domain for public URLs (if not set, uses bucket URL)
    S3_PUBLIC_BASE_URL: Optional[str] = os.getenv("S3_PUBLIC_BASE_URL")

# Create settings instance
settings = Settings()

# Validate configuration on import
if not Settings.validate_config():
    print("WARNING: Configuration validation failed. Please check your environment variables.") 