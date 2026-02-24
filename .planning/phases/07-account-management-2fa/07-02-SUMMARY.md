---
phase: 07-account-management-2fa
plan: 02
subsystem: api
tags: [brand, account-management, 2fa, security, inactive-filter]
dependency_graph:
  requires: [07-01]
  provides: [brand-account-management-api, 2fa-management-api, inactive-brand-filter]
  affects: [packages/api/main.py, packages/api/schemas.py]
tech_stack:
  added: []
  patterns: [brand-inactive-filter, otp-email-confirm, password-history]
key_files:
  created: []
  modified:
    - packages/api/schemas.py
    - packages/api/main.py
decisions:
  - "[07-02] brand_enable_2fa uses `import secrets as _secrets` inline to avoid collision with top-level `secrets` module name"
  - "[07-02] GET /api/v1/products/{product_id} uses product.brand.is_inactive check (lazy load) — not a separate join — consistent with existing pattern"
  - "[07-02] Inactive filter applied to 7 buyer-facing queries: brands list, favorites, recent-swipes, recommendations (user+friend), popular, search, single product"
metrics:
  duration_minutes: 12
  completed_date: "2026-02-24"
  tasks_completed: 3
  files_modified: 2
---

# Phase 7 Plan 02: Brand Account Management + 2FA Endpoints Summary

Brand account management + 2FA endpoints: inactive toggle, scheduled deletion (30-day grace), change password with history check, 2FA enable/confirm/disable via OTP email; inactive brand filter on all buyer-facing product/brand queries.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add schemas for account management + 2FA | c924ba0 | packages/api/schemas.py |
| 2 | Implement account management + 2FA endpoints | 8ad4634 | packages/api/main.py |
| 3 | Filter inactive brands from buyer-facing product endpoints | 4b9f1f0 | packages/api/main.py |

## What Was Built

**6 new endpoints in main.py:**
- `PATCH /api/v1/brands/me/inactive` — toggle brand visibility
- `DELETE /api/v1/brands/me` — schedule deletion (sets is_inactive=True, scheduled_deletion_at=now+30d)
- `POST /api/v1/brands/auth/change-password` — validates current pw, checks history (last 5), updates hash
- `POST /api/v1/brands/auth/2fa/enable` — generates 6-digit OTP, emails it (rate-limited 5/min)
- `POST /api/v1/brands/auth/2fa/confirm` — validates OTP, sets two_factor_enabled=True
- `POST /api/v1/brands/auth/2fa/disable` — requires password re-entry, sets two_factor_enabled=False

**BrandResponse updated** with: `is_inactive`, `scheduled_deletion_at`, `two_factor_enabled` — populated from brand model and `brand.auth_account`.

**Inactive filter applied** to 7 buyer-facing endpoints: `GET /api/v1/brands`, `GET /api/v1/user/favorites`, `GET /api/v1/user/recent-swipes`, `GET /api/v1/recommendations/for_user`, `GET /api/v1/recommendations/for_friend/{id}`, `GET /api/v1/products/popular`, `GET /api/v1/products/search`. Single-product endpoint returns 404 if brand is inactive.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- packages/api/schemas.py — modified (BrandResponse + 6 new schema classes)
- packages/api/main.py — modified (6 endpoints + 7 inactive filters)
- Commits: c924ba0, 8ad4634, 4b9f1f0 all present
- `python -c "import main; print('OK')"` — passed
