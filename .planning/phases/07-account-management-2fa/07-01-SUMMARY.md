---
phase: 07-account-management-2fa
plan: 01
subsystem: database
tags: [sqlalchemy, alembic, postgres, 2fa, otp, brand-management]

# Dependency graph
requires:
  - phase: 06-product-enrichment-api-web
    provides: sale_price/sale_type columns and sizing_table_image in products table
provides:
  - Brand.is_inactive + Brand.scheduled_deletion_at columns in DB
  - AuthAccount 2FA columns (two_factor_enabled, otp_code, otp_session_token, etc.)
  - OTP config constants in Settings (5 constants)
  - Migration 07_account_management_2fa applied to DB
affects: [07-02, 07-03, 07-04, auth_service, brand endpoints]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "otp_session_token as String(64) ties login session to OTP challenge; cleared after verify"
    - "server_default='false' and server_default='0' for non-nullable Boolean/Integer columns in migration"

key-files:
  created:
    - packages/api/alembic/versions/07_account_management_2fa.py
  modified:
    - packages/api/models.py
    - packages/api/config.py

key-decisions:
  - "[07-01] otp_session_token is String(64) = secrets.token_hex(32); prevents forgeable base64(email) session binding"
  - "[07-01] is_inactive separates brand visibility from account deletion (scheduled_deletion_at for deferred purge)"
  - "[07-01] All OTP limits env-configurable via Settings: expire=5min, max_fails=5, lockout=15min, max_resends=3, cooldown=60s"

patterns-established:
  - "Brand soft-disable: is_inactive=True hides brand + products from marketplace without deletion"
  - "Deferred deletion: scheduled_deletion_at set to now+30d; background job or on-login check triggers purge"

requirements-completed: [ACCT-01, ACCT-02, ACCT-03, 2FA-01, 2FA-02, 2FA-03]

# Metrics
duration: 5min
completed: 2026-02-24
---

# Phase 7 Plan 1: Account Management 2FA DB Foundation Summary

**Brand inactive/deletion columns + 8 AuthAccount 2FA columns (incl. otp_session_token) + Alembic migration applied**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-02-24
- **Completed:** 2026-02-24
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `is_inactive` (Boolean) and `scheduled_deletion_at` (DateTime) to Brand model for marketplace visibility control and deferred deletion
- Added 8 2FA columns to AuthAccount: OTP code + expiry, session token (String 64), failed attempts counter, lockout timestamp, resend count + window start
- Added 5 OTP config constants to Settings class (all env-overridable)
- Created and applied migration `07_account_management_2fa` — DB is at new head

## Task Commits

1. **Task 1: Brand inactive/deletion columns** - `aa593bb` (feat)
2. **Task 2: AuthAccount 2FA + config + migration** - `8ecc62a` (feat)

## Files Created/Modified
- `packages/api/models.py` - Brand + AuthAccount new columns
- `packages/api/config.py` - OTP_EXPIRE_MINUTES, OTP_MAX_FAILED_ATTEMPTS, OTP_LOCKOUT_MINUTES, OTP_MAX_RESENDS, OTP_RESEND_COOLDOWN_SECONDS
- `packages/api/alembic/versions/07_account_management_2fa.py` - Migration adding all 10 new columns

## Decisions Made
- otp_session_token is String(64) (= secrets.token_hex(32)) to bind OTP challenge to specific login session — prevents attacker with intercepted OTP from completing a different session
- is_inactive kept separate from scheduled_deletion_at: brand can be hidden without requesting deletion
- All OTP behavior thresholds env-configurable for ops flexibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## Next Phase Readiness
- All DB columns exist; 07-02 (API endpoints) can now read/write is_inactive, scheduled_deletion_at, two_factor_enabled, otp_*, failed_otp_attempts, otp_locked_until
- settings.OTP_* constants ready for use in auth_service

---
*Phase: 07-account-management-2fa*
*Completed: 2026-02-24*
