---
phase: 07-account-management-2fa
plan: 03
subsystem: auth
tags: [2fa, otp, jwt, fastapi, pydantic, rate-limiting]

requires:
  - phase: 07-02
    provides: AuthAccount 2FA fields (otp_session_token, otp_code, failed_otp_attempts, otp_locked_until, otp_resend_count, otp_resend_window_start), brand_enable_2fa/confirm/disable endpoints
provides:
  - brand_login 2FA branch (202 + session_token when two_factor_enabled=True)
  - POST /api/v1/brands/auth/2fa/verify endpoint
  - POST /api/v1/brands/auth/2fa/resend endpoint
  - _issue_brand_jwt helper for reusable JWT issuance
  - BrandLoginResponse, BrandVerifyOTP, BrandResendOTP schemas
affects: [mobile 2FA login flow, frontend brand portal login]

tech-stack:
  added: []
  patterns:
    - session_token lookup (AuthAccount.otp_session_token) instead of email lookup for OTP verify/resend — prevents session forgery
    - _issue_brand_jwt helper extracted from brand_login to avoid duplication between direct login and 2FA verify paths

key-files:
  created: []
  modified:
    - packages/api/schemas.py
    - packages/api/main.py

key-decisions:
  - "[07-03] brand_login 2FA branch uses secrets.token_hex(32) for session_token — stored in AuthAccount.otp_session_token; not derivable from email"
  - "[07-03] /2fa/verify and /2fa/resend look up AuthAccount by otp_session_token (not email) — prevents forgery"
  - "[07-03] brand_login route gets @limiter.limit(10/minute) + request:Request added (was missing, needed for slowapi)"
  - "[07-03] _issue_brand_jwt extracted above brand_login — shared by non-2FA login and 2FA verify success paths"
  - "[07-03] otp_session_token cleared after successful verify (one-time use)"

patterns-established:
  - "2FA session binding via opaque DB token (not email-based) — lookup by otp_session_token"
  - "Lockout check at both login challenge and verify steps for defense in depth"

requirements-completed: [2FA-01, 2FA-02, 2FA-03]

duration: 15min
completed: 2026-02-24
---

# Phase 7 Plan 03: 2FA Login Challenge Summary

**Brand login 2FA flow complete: credentials check returns 202+session_token when enabled; /2fa/verify validates OTP and issues JWT; /2fa/resend enforces 3-resend limit and 60s cooldown.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-24T00:00:00Z
- **Completed:** 2026-02-24T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- brand_login: 2FA branch generates OTP + secrets.token_hex(32) session token, emails OTP, returns 202 JSON; non-2FA path returns JWT directly via _issue_brand_jwt helper
- POST /api/v1/brands/auth/2fa/verify: lookup by otp_session_token, lockout/expiry/code validation, failed_otp_attempts tracking, locks after 5 fails (15min), clears all OTP state on success, returns JWT
- POST /api/v1/brands/auth/2fa/resend: max 3 resends, 60s cooldown, generates fresh OTP, sends email

## Task Commits

1. **Task 1: Add 2FA login schemas** - `47918b1` (feat)
2. **Task 2: Modify brand_login + add 2FA verify/resend endpoints** - `c16d8af` (feat)

**Plan metadata:** _(pending final commit)_

## Files Created/Modified
- `packages/api/schemas.py` - Added BrandLoginResponse, BrandVerifyOTP, BrandResendOTP; added Any to typing imports
- `packages/api/main.py` - _issue_brand_jwt helper; brand_login 2FA branch with @limiter.limit; /2fa/verify endpoint; /2fa/resend endpoint

## Decisions Made
- session_token is secrets.token_hex(32) stored in DB — verify/resend look up by this token, not email, preventing forgery
- brand_login was missing @limiter.limit and request:Request — added (Rule 2: missing critical)
- _issue_brand_jwt helper extracted to avoid duplication
- brand_verify_2fa uses `db.query(Brand).filter(Brand.auth_account_id == acc.id).first()` (explicit FK query) rather than relationship attribute — AuthAccount.brand is uselist=False so either works, but explicit query is unambiguous

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added @limiter.limit + request:Request to brand_login**
- **Found during:** Task 2
- **Issue:** Plan noted brand_login was missing @limiter.limit decorator — required for slowapi to work
- **Fix:** Added @limiter.limit("10/minute") and request:Request as first param
- **Files modified:** packages/api/main.py
- **Verification:** python -c "import main" succeeds; grep confirms decorator present
- **Committed in:** c16d8af (Task 2 commit)

**2. [Rule 1 - Bug] _issue_brand_jwt uses only valid UserProfileResponse fields**
- **Found during:** Task 2
- **Issue:** Plan template for _issue_brand_jwt passed return_policy/min_free_shipping/shipping_price/shipping_provider but UserProfileResponse doesn't have those fields
- **Fix:** Omitted those extra fields (they were silently ignored before; UserProfileResponse only accepts its declared fields)
- **Files modified:** packages/api/main.py
- **Verification:** API imports cleanly; no validation errors
- **Committed in:** c16d8af (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both essential for correctness. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED

All files present. All commits verified.

## Next Phase Readiness
- 2FA login flow fully implemented in API; ready for mobile client integration (plan 07-04)
- All OTP limits configurable via Settings (env vars): OTP_EXPIRE_MINUTES, OTP_MAX_FAILED_ATTEMPTS, OTP_LOCKOUT_MINUTES, OTP_MAX_RESENDS, OTP_RESEND_COOLDOWN_SECONDS

---
*Phase: 07-account-management-2fa*
*Completed: 2026-02-24*
