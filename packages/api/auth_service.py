"""
Authentication service for user operations and OAuth integration
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import User, OAuthAccount, UserProfile, Gender, AuthAccount
from oauth_service import oauth_service
from config import settings
import bcrypt
import jwt
from datetime import datetime, timedelta
import uuid
import secrets

class AuthService:
    """Authentication service for user operations"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    
    @staticmethod
    def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp": expire})
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    
    @staticmethod
    def verify_token_payload(token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return its payload"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            return payload
        except jwt.PyJWTError:
            return None
    
    @staticmethod
    def create_user(
        db: Session,
        username: str,
        email: str,
        password_hash: Optional[str] = None,
        gender: Optional[str] = None,
        selected_size: Optional[str] = None,
        avatar_url: Optional[str] = None,
        is_email_verified: bool = False,
    ) -> User:
        """Create a new user and optionally create UserProfile if profile data is provided"""
        auth_account = AuthAccount(
            id=str(uuid.uuid4()),
            email=email,
            password_hash=password_hash,
            is_email_verified=is_email_verified,
        )
        db.add(auth_account)
        db.flush()
        user = User(
            id=str(uuid.uuid4()),
            username=username,
            auth_account_id=auth_account.id,
        )
        db.add(user)
        db.flush()
        if any([gender, selected_size, avatar_url]):
            profile = UserProfile(
                user_id=user.id,
                gender=Gender(gender) if gender else None,
                selected_size=selected_size,
                avatar_url=avatar_url
            )
            db.add(profile)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get user by email (excludes deleted accounts)"""
        return db.query(User).join(AuthAccount).filter(
            AuthAccount.email == email,
            User.deleted_at.is_(None),
        ).first()

    @staticmethod
    def get_user_by_username(db: Session, username: str) -> Optional[User]:
        """Get user by username (excludes deleted accounts)"""
        return db.query(User).filter(
            User.username == username,
            User.deleted_at.is_(None),
        ).first()

    @staticmethod
    def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
        """Get user by ID (excludes deleted accounts)"""
        return db.query(User).filter(
            User.id == user_id,
            User.deleted_at.is_(None),
        ).first()
    
    @staticmethod
    def get_oauth_account(db: Session, provider: str, provider_user_id: str) -> Optional[OAuthAccount]:
        """Get OAuth account by provider and provider user ID"""
        return db.query(OAuthAccount).filter(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id
        ).first()
    
    @staticmethod
    def create_oauth_account(
        db: Session,
        user_id: str,
        provider: str,
        provider_user_id: str,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> OAuthAccount:
        """Create a new OAuth account"""
        oauth_account = OAuthAccount(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at=expires_at
        )
        db.add(oauth_account)
        db.commit()
        db.refresh(oauth_account)
        return oauth_account
    
    @staticmethod
    def update_oauth_account(
        db: Session,
        oauth_account: OAuthAccount,
        access_token: Optional[str] = None,
        refresh_token: Optional[str] = None,
        expires_at: Optional[datetime] = None
    ) -> OAuthAccount:
        """Update OAuth account tokens"""
        if access_token:
            oauth_account.access_token = access_token
        if refresh_token:
            oauth_account.refresh_token = refresh_token
        if expires_at:
            oauth_account.expires_at = expires_at
        
        oauth_account.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(oauth_account)
        return oauth_account
    
    @staticmethod
    async def handle_oauth_login(db: Session, provider: str, token: str) -> Optional[Dict[str, Any]]:
        """Handle OAuth login for a specific provider"""
        user_info = None
        
        # Get user info from provider
        if provider == 'google':
            user_info = await oauth_service.get_google_user_info(token)
        elif provider == 'facebook':
            user_info = await oauth_service.get_facebook_user_info(token)
        elif provider == 'github':
            user_info = await oauth_service.get_github_user_info(token)
        elif provider == 'apple':
            user_info = await oauth_service.verify_apple_token(token)
        
        if not user_info:
            return None
        
        # Check if OAuth account already exists
        oauth_account = AuthService.get_oauth_account(
            db, provider, user_info['provider_user_id']
        )
        
        if oauth_account:
            # Update existing OAuth account
            AuthService.update_oauth_account(db, oauth_account, access_token=token)
            user = oauth_account.user
        else:
            # Check if user exists with same email
            user = AuthService.get_user_by_email(db, user_info['email'])
            
            if user:
                # Create OAuth account for existing user
                AuthService.create_oauth_account(
                    db, user.id, provider, user_info['provider_user_id'], token
                )
            else:
                # Create new user and OAuth account
                username = AuthService._generate_unique_username(db, user_info)
                user = AuthService.create_user(
                    db=db,
                    username=username,
                    email=user_info['email'],
                    avatar_url=user_info['avatar_url'],
                    is_email_verified=user_info.get('is_email_verified', False) # Use is_email_verified
                )
                
                AuthService.create_oauth_account(
                    db, user.id, provider, user_info['provider_user_id'], token
                )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = AuthService.create_access_token(
            data={"sub": user.id}, expires_delta=access_token_expires
        )
        
        # Get avatar_url from profile if it exists
        avatar_url = user.profile.avatar_url if user.profile else None
        return {
            "token": access_token,
            "expires_at": datetime.utcnow() + access_token_expires,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.auth_account.email,
                "avatar_url": avatar_url,
                "is_email_verified": user.auth_account.is_email_verified,
                "created_at": user.created_at,
                "updated_at": user.updated_at
            }
        }
    
    @staticmethod
    def _generate_unique_username(db: Session, user_info: Dict[str, Any]) -> str:
        """Generate a unique username from user info"""
        base_username = user_info.get('email', '').split('@')[0]
        base_username = ''.join(c for c in base_username if c.isalnum() or c in '_-')
        
        if not base_username:
            base_username = 'user'
        
        username = base_username
        counter = 1
        
        while AuthService.get_user_by_username(db, username):
            username = f"{base_username}{counter}"
            counter += 1
        
        return username

    @staticmethod
    def _generate_secure_token(length=32):
        """Generate a cryptographically secure random token."""
        return secrets.token_urlsafe(length)

    def create_verification_code(self, db: Session, principal):
        """Generate and store an email verification code (principal is User or Brand with auth_account)."""
        code = ''.join(secrets.choice('0123456789') for _ in range(6))
        acc = principal.auth_account
        acc.email_verification_code = code
        acc.email_verification_code_expires_at = datetime.utcnow() + timedelta(minutes=settings.EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES)
        db.commit()
        return code

    def create_password_reset_token(self, db: Session, principal):
        """Generate and store a password reset token (principal is User or Brand with auth_account)."""
        token = self._generate_secure_token()
        acc = principal.auth_account
        acc.password_reset_token = token
        acc.password_reset_expires = datetime.utcnow() + timedelta(minutes=15)
        db.commit()
        return token

    @staticmethod
    def create_admin_account(db: Session, email: str, password: str) -> AuthAccount:
        """Create a standalone admin AuthAccount (no linked User or Brand)."""
        existing = db.query(AuthAccount).filter(AuthAccount.email == email).first()
        if existing:
            if not existing.is_admin:
                existing.is_admin = True
                existing.password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                db.commit()
            return existing
        acc = AuthAccount(
            email=email,
            password_hash=bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8'),
            is_admin=True,
            is_email_verified=True,
        )
        db.add(acc)
        db.commit()
        db.refresh(acc)
        return acc

    @staticmethod
    def get_admin_by_email(db: Session, email: str) -> Optional[AuthAccount]:
        """Return an admin AuthAccount by email, or None."""
        return db.query(AuthAccount).filter(
            AuthAccount.email == email,
            AuthAccount.is_admin == True,
        ).first()

# Create auth service instance
auth_service = AuthService()