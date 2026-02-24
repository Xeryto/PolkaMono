# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Brands can run their storefront end-to-end; buyers get a smooth, trustworthy purchase experience.
**Current focus:** Milestone v1.1 — Phase 6: Product Enrichment API + Web

## Current Position

Phase: 6 of 9 (Product Enrichment API + Web)
Plan: 1 of 3 in current phase
Status: In progress
Last activity: 2026-02-24 — completed plan 06-01 (product enrichment API: sale_price, sale_type, sizing_table_image + migration)

Progress: [███░░░░░░░] 25% (v1.1)

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
Stopped at: Completed 06-01-PLAN.md — product enrichment API (sale_price, sale_type, sizing_table_image)
Resume file: None
