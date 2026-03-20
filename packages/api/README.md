# Polka API

FastAPI backend for the Polka fashion marketplace. Handles authentication, product catalog, payments, recommendations, push notifications, and admin operations.

Part of the [Polka monorepo](../../README.md).

## Tech stack

- FastAPI 0.104.1 + Uvicorn 0.24.0
- SQLAlchemy >= 2.0.43 + Alembic 1.12.1
- Pydantic >= 2.8.0
- PostgreSQL (psycopg2-binary >= 2.9.10)
- YooKassa 2.1.0 (payments)
- Authlib 1.2.1 + python-jose 3.3.0 (OAuth / JWT)
- APScheduler >= 3.10.0 (background jobs)
- boto3 >= 1.34.0 (S3 image uploads)
- slowapi (rate limiting)

## Setup

From the monorepo root:

```bash
yarn install:all          # Creates .venv and installs pip deps
cp packages/api/.env.example packages/api/.env
# Edit .env with your database URL, secret key, etc.
cd packages/api
make db-init              # Runs migrations + seeds sample data
make run-dev              # Starts uvicorn with --reload on :8000
```

Or manually:

```bash
cd packages/api
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
make db-init
make run-dev
```

API docs at `http://localhost:8000/docs` (Swagger) and `/redoc`.

## Environment variables

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `SECRET_KEY` | yes | — | JWT signing secret |
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `ENVIRONMENT` | no | `development` | `development` / `staging` / `production` |
| `DEBUG` | no | `False` | Enable debug logging |
| `OAUTH_REDIRECT_URL` | yes | — | OAuth callback URL |
| `LOG_LEVEL` | no | `DEBUG` (dev) / `INFO` (prod) | Logging level |

### Payments (YooKassa)

| Variable | Required | Description |
|---|---|---|
| `YOOKASSA_SHOP_ID` | for payments | Shop identifier |
| `YOOKASSA_SECRET_KEY` | for payments | API secret key |

### Email (Unisender)

| Variable | Required | Description |
|---|---|---|
| `UNISENDER_API_KEY` | for email | API key |
| `UNISENDER_FROM_EMAIL` | for email | Sender address |
| `UNISENDER_FROM_NAME` | for email | Sender display name |
| `UNISENDER_LIST_ID` | for email | Mailing list ID |

### OAuth

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `FACEBOOK_CLIENT_ID` / `FACEBOOK_CLIENT_SECRET` | Facebook OAuth |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth |
| `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple OAuth |

### S3 (image uploads)

| Variable | Default | Description |
|---|---|---|
| `AWS_ACCESS_KEY_ID` | — | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | — | AWS credentials |
| `AWS_REGION` | `us-east-1` | S3 region |
| `S3_BUCKET_NAME` | — | Bucket for avatars and product images |
| `S3_PUBLIC_BASE_URL` | — | Optional CloudFront / custom domain for public URLs |

### Admin

| Variable | Description |
|---|---|
| `ADMIN_EMAIL` | Admin account email |
| `ADMIN_PASSWORD` | Admin account password |

### Tuning (all have defaults)

| Variable | Default | Description |
|---|---|---|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `30` | User JWT lifetime |
| `BRAND_TOKEN_EXPIRE_MINUTES` | `1440` | Brand JWT lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `60` | Refresh token lifetime |
| `EMAIL_VERIFICATION_CODE_EXPIRE_MINUTES` | `10` | Email code expiry |
| `ORDER_PENDING_EXPIRY_HOURS` | `24` | Auto-cancel unpaid orders after |
| `OTP_EXPIRE_MINUTES` | `5` | 2FA code lifetime |
| `OTP_MAX_FAILED_ATTEMPTS` | `5` | Lock after N wrong OTPs |
| `OTP_LOCKOUT_MINUTES` | `15` | OTP lockout duration |
| `OTP_MAX_RESENDS` | `3` | Max OTP resend attempts |
| `OTP_RESEND_COOLDOWN_SECONDS` | `60` | Seconds between OTP resends |
| `LOGIN_MAX_FAILED_ATTEMPTS` | `5` | Lock after N wrong passwords |
| `LOGIN_LOCKOUT_MINUTES` | `15` | Login lockout duration |
| `BRAND_DELETION_GRACE_DAYS` | `30` | Days before brand data is purged |

## Architecture

All routes live in `main.py`. Domain logic is split across service modules:

| Module | Responsibility |
|---|---|
| `models.py` | SQLAlchemy ORM models |
| `schemas.py` | Pydantic request/response schemas |
| `auth_service.py` | JWT, bcrypt, user/brand CRUD, OTP |
| `oauth_service.py` | Google / Facebook / GitHub / Apple OAuth |
| `payment_service.py` | YooKassa payments, webhook verification, order lifecycle |
| `mail_service.py` | Transactional email via Unisender |
| `storage_service.py` | S3 presigned URL generation |
| `notification_service.py` | Expo push notifications, order status updates |
| `recommendation_service.py` | Swipe-signal product recommendations, category affinity |
| `profanity.py` | Username filter (EN/RU) with character substitution detection |
| `database.py` | SQLAlchemy engine, session, `get_db` dependency |
| `config.py` | Settings from environment variables |

### Dual-entity auth model

Two principal types — `User` (buyers) and `Brand` (sellers) — share a single `AuthAccount` table for credentials (email, password hash, verification codes, 2FA). Brand JWTs include `"is_brand": True`.

- `get_current_user()` returns either a `User` or `Brand`
- `get_current_brand_user()` asserts the caller is a `Brand`, raises 403 otherwise

User PKs are UUID strings; Brand PKs are auto-increment integers.

### Key data model relationships

```
AuthAccount ──< User
             └─< Brand
User ──< UserProfile (full_name, avatar, size)
     ├─< UserShippingInfo
     ├─< UserPreferences (privacy, notifications)
     ├─< UserBrand (favorite brands, many-to-many)
     ├─< UserStyle (favorite styles, many-to-many)
     └─< UserSwipe
Brand ──< Product ──< ProductColorVariant ──< ProductVariant (size + stock)
Checkout ──< Order (one per brand) ──< OrderItem
```

## Endpoint groups

~109 endpoints total, grouped by domain:

| Domain | Count | Prefix | Notes |
|---|---|---|---|
| User auth | 16 | `/api/v1/auth/` | Register, login, OAuth, refresh, email verify, password reset, logout |
| Brand auth | 10 | `/api/v1/brands/auth/` | Login, 2FA enable/verify/disable, password reset |
| Admin auth | 4 | `/api/v1/admin/auth/` | Login, 2FA verify/resend, session check |
| User profile | 20 | `/api/v1/user/`, `/api/v1/users/` | Profile CRUD, stats, swipe, shipping, preferences, push token, avatar upload, search, delete account |
| Brand management | 7 | `/api/v1/brands/` | List, create, profile, stats, image upload, soft-delete |
| Brand products | 4 | `/api/v1/brands/products/` | CRUD |
| Brand orders | 2 | `/api/v1/brands/orders/` | Tracking, SKU update |
| Categories/styles | 5 | `/api/v1/categories/`, `/api/v1/styles/` | Browse categories/sizes, set favorites |
| Products (public) | 3 | `/api/v1/products/` | Detail, popular, search (pg_trgm + Russian FTS) |
| Favorites | 3 | `/api/v1/user/favorites/`, `/api/v1/user/recent-swipes` | Toggle, list, recent swipes |
| Recommendations | 2 | `/api/v1/recommendations/` | For user, for friend |
| Friends | 8 | `/api/v1/friends/` | Request, accept/reject/cancel, list, remove |
| Orders | 6 | `/api/v1/orders/` | Create test order, confirm, list, detail, cancel |
| Payments | 3 | `/api/v1/payments/` | Create, status, YooKassa webhook |
| Notifications | 2 | `/api/v1/notifications/` | List, mark read |
| Admin | 14 | `/api/v1/admin/` | Send notifications, returns, orders, withdrawals, brand CRUD |
| Waitlist | 1 | `/api/v1/exclusive-access-signup` | Email signup for early access |
| Legacy | 1 | `/api/v1/checkouts/{id}` | Checkout lookup (deprecated) |
| Utility | 1 | `/health` | Health check |

## Background jobs

APScheduler runs two hourly jobs:

1. **Order expiry** — cancels `CREATED` orders past `expires_at`, restores stock
2. **Brand purge** — anonymizes brands past their `scheduled_deletion_at` (clears PII, zeroes stock, wipes images)

## Search

Product search uses PostgreSQL `pg_trgm` for fuzzy matching and Russian-language full-text search (`to_tsvector('russian', ...)`). The `pg_trgm` extension is enabled during `db-init`.

## Makefile commands

```
make help          Show available commands
make install       pip install -r requirements.txt
make run           python main.py
make run-dev       uvicorn with --reload on 0.0.0.0:8000
make test          pytest tests/ -v
make coverage      pytest with coverage report (terminal + HTML)
make format        black + isort
make lint          flake8 + mypy
make clean         Remove .pyc / __pycache__ / .egg-info
make db-init       alembic upgrade head + populate_data.py
make db-migrate    alembic upgrade head
make db-migration  alembic autogenerate (message='...')
make docs          Print Swagger/ReDoc URLs
```

## Testing

Test suite in `tests/`:

| File | Coverage |
|---|---|
| `test_registration.py` | User/brand registration flows |
| `test_login.py` | Login, JWT, refresh |
| `test_security.py` | Rate limiting, auth guards |
| `test_payments.py` | Payment creation, webhooks |
| `test_preferences.py` | User preferences, favorites |
| `test_recommendations.py` | Recommendation engine |
| `test_products.py` | Product CRUD, search |
| `test_social.py` | Friend requests, social features |
| `test_user_profile.py` | Profile CRUD, shipping |
| `test_order_lifecycle.py` | Order creation through completion |
| `test_cross_account_isolation.py` | User/brand data isolation |
| `conftest.py` | Fixtures, test DB setup |
| `factories.py` | Test data factories |

```bash
make test                # Run all tests
make coverage            # Tests + coverage report
```

## Deployment

- **Dockerfile**: multi-stage build on `python:3.10-slim`, non-root `appuser`, exposes port 8000
- **Alembic prod safety**: `alembic/env.py` blocks migrations against production unless `ALLOW_PROD_MIGRATE=1`
- **Rate limiting**: all public endpoints rate-limited via slowapi; auth endpoints at 5-10/minute
- API errors and validation messages are localized to Russian
