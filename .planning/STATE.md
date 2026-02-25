# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Brands can run their storefront end-to-end; buyers get a smooth, trustworthy purchase experience.
**Current focus:** Milestone v1.1 — Phase 8: Notifications

## Current Position

Phase: 8 of 9 (Notifications)
Plan: 3 of 4 in current phase
Status: In progress
Last activity: 2026-02-24 — completed plan 08-03 (Push notification infrastructure: expo-notifications installed, expo_push_token on User, POST /api/v1/users/push-token, tap-to-navigate listener)

Progress: [████░░░░░░] 35% (v1.1)

## Performance Metrics

**Velocity:**
- Total plans completed: 7 (v1.0)
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Light Mode Fixes | 2 | — | — |
| 2. Dark Mode | 5 | — | — |

*Updated after each plan completion*
| Phase 05-brand-profile-restructure P02 | 15 | 2 tasks | 2 files |
| Phase 05-brand-profile-restructure P03 | 10 | 2 tasks | 1 files |
| Phase 06-product-enrichment-api-web P01 | 10 | 3 tasks | 4 files |
| Phase 06-product-enrichment-api-web P02 | 2 | 3 tasks | 3 files |
| Phase 06-product-enrichment-api-web P03 | 2 | 2 tasks | 1 files |
| Phase 07-account-management-2fa P01 | 5 | 2 tasks | 3 files |
| Phase 07-account-management-2fa P02 | 12 | 3 tasks | 2 files |
| Phase 07-account-management-2fa P03 | 15 | 2 tasks | 2 files |
| Phase 07-account-management-2fa P04 | 4 | 3 tasks | 5 files |
| Phase 08-notifications P01 | 10 | 2 tasks | 5 files |
| Phase 08-notifications P03 | 30 | 2 tasks | 7 files |
| Phase 08-notifications P02 | 2 | 2 tasks | 4 files |
| Phase 08-notifications P03 | 30 | 2 tasks | 7 files |

## Accumulated Context

### Decisions

See PROJECT.md Key Decisions table for full log. Active decisions for v1.1:

- Order statuses stored in DB table (auditable, consistent across clients)
- Per-product delivery time overrides brand default (brand confirmed model)
- Single global admin inside brand portal (upgrade later)
- Expo Push Notifications for mobile (App Store ready, no extra infra)
- [04-01] Migration guards ALTER TYPE orderstatus behind pg_type existence check (column is VARCHAR not PG enum)
- [04-01] OrderStatusEvent uses UUID string PK for consistency with rest of models
- [04-01] expires_at nullable; set at order creation for CREATED/PENDING orders
- [04-02] record_status_event() does not commit — caller owns transaction boundary
- [04-02] Buyer cancel rejects expired orders even if status still CREATED (defensive)
- [04-02] Admin identity = ADMIN_EMAIL env var match on brand auth_account.email (no DB column)
- [04-02] APScheduler started at module-load, not inside startup event
- [04-03] _checkout_to_summary() sums shipping_cost across child orders for buyer total visibility
- [04-03] shipping_cost optional (?:number) in TS OrderSummary so old cached responses don't break
- [05-01] New validators use @field_validator (Pydantic v2); existing @validator decorators left untouched to preserve compat mode
- [05-01] delivery_time_min/max nullable on both Brand and Product; None on Product means fall back to brand default
- [05-01] Product update delivery_time fields handled via setattr fallthrough in update_product route
- [Phase 05-02]: Legal fields (INN/address/payout_account) read-only modal only; no edit path in brand portal
- [Phase 05-02]: payout_account_locked checkbox removed from brand portal UI entirely (admin-only)
- [Phase 05-02]: parsePydanticErrors in api.ts + ApiError.fieldErrors enables 422 server validation surfacing in UI
- [05-03]: DELIVERY_TIME_OPTIONS local const; empty string sentinel for undefined in Radix Select
- [05-03]: Structural color-variant validations remain toasts; scalar field errors go inline via Zod
- [Phase 06-01]: [06-01] sale_type validated via Pydantic regex pattern not DB enum
- [Phase 06-01]: [06-01] delivery_time_min/max backfilled into product_to_schema (were written in Ph5 but never returned)
- [Phase 06-02]: [06-02] sale_price/sale_type use null not undefined in updateProduct param type so JSON.stringify includes the clear signal
- [Phase 06-02]: [06-02] saleType state uses '' as no-sale sentinel; converted to null before API call (consistent with 05-03 delivery time pattern)
- [Phase 06-02]: [06-02] Remove-sale button uses e.stopPropagation() to prevent modal open on row click
- [Phase 06-product-enrichment-api-web]: [06-03] DELIVERY_TIME_OPTIONS copied locally per plan — avoids import coupling between pages
- [Phase 06-product-enrichment-api-web]: [06-03] sizingTableImage null (not '') — simpler truthiness; only http URLs forwarded to API on save
- [07-01] otp_session_token is String(64) = secrets.token_hex(32); prevents forgeable base64(email) session binding
- [07-01] is_inactive separates brand visibility from account deletion (scheduled_deletion_at for deferred purge)
- [07-01] All OTP limits env-configurable via Settings: expire=5min, max_fails=5, lockout=15min, max_resends=3, cooldown=60s
- [07-02] brand_enable_2fa uses `import secrets as _secrets` inline to avoid collision with top-level `secrets` module name
- [07-02] GET /api/v1/products/{product_id} uses product.brand.is_inactive lazy-load check (not join) — consistent with existing pattern
- [07-02] Inactive filter applied to 7 buyer-facing queries: brands list, favorites, recent-swipes, recommendations (user+friend), popular, search, single product
- [07-03] brand_login 2FA branch uses secrets.token_hex(32) session_token stored in DB; verify/resend look up by token not email (prevents forgery)
- [07-03] brand_login gets @limiter.limit(10/minute) + request:Request (was missing)
- [07-03] _issue_brand_jwt extracted as shared helper for non-2FA login and 2FA verify success paths
- [07-03] otp_session_token cleared after successful verify (one-time use)
- [07-04] Portal calls api.brandLogin directly to intercept otp_required before AuthContext login
- [07-04] handleLoginSuccess uses window.location.href hard redirect after 2FA verify (AuthContext re-reads localStorage)
- [07-04] BrandResponse extended with is_inactive + two_factor_enabled (already returned by API)
- [07-04] resendCount initialized to 1 on first OTP send; disabled when >= 3
- [08-01] Migration uses IF NOT EXISTS guard — notifications table pre-existed in DB; idempotent upgrade
- [08-01] notification_service.py uses Optional[str] not str|None (Python 3.9 compat)
- [08-01] Test order notifications fired in endpoint after create_order_test() returns, querying checkout orders by checkout_id
- [08-02] fetchNotifications/markNotificationsRead use apiRequest helper with token param (not raw fetch + localStorage) — consistent with existing api.ts pattern
- [08-02] onTargetOrder propagated via props (not context) — simpler, no extra context overhead
- [Phase 08-03]: [08-03] app.json notification icon uses icon.png fallback; setNotificationHandler uses shouldShowBanner+shouldShowList (SDK 0.32); triggerPushRegistration() helper at all transitionTo(main) sites; navigationRef lifted to AppContent; Tap listener passes openOrderId to Wall (receiving screen deferred to 08-04)

### Pending Todos

None.

### Blockers/Concerns

None.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Consolidate theme system - remove duplicates, base on light mode, reference commit 2bb91e2 | 2026-02-22 | 0d4e477 | [1-consolidate-theme-system-remove-duplicat](.planning/quick/1-consolidate-theme-system-remove-duplicat/) |
| 2 | Verify every light mode color - migrate Settings to createStyles(theme), fix remaining hardcoded colors | 2026-02-23 | 3deb89c | [2-verify-every-single-color-in-light-mode-](.planning/quick/2-verify-every-single-color-in-light-mode-/) |
| 3 | Fix 3 security vulnerabilities from SECURITY_REVIEW.md | 2026-02-23 | ec99c95 | [3-fix-3-security-vulnerabilities-from-secu](.planning/quick/3-fix-3-security-vulnerabilities-from-secu/) |

## Session Continuity

Last session: 2026-02-24
Stopped at: Completed 08-03-PLAN.md — push notification infrastructure complete
Resume file: None
