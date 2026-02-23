# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-23)

**Core value:** Brands can run their storefront end-to-end; buyers get a smooth, trustworthy purchase experience.
**Current focus:** Milestone v1.1 — Phase 4: Order Status Foundation

## Current Position

Phase: 4 of 9 (Order Status Foundation)
Plan: 2 of 3 in current phase
Status: In progress
Last activity: 2026-02-23 — completed plan 04-02 (order lifecycle endpoints + APScheduler expiry)

Progress: [█░░░░░░░░░] 10% (v1.1)

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Session Continuity

Last session: 2026-02-23
Stopped at: Completed 04-02-PLAN.md (order lifecycle endpoints + APScheduler expiry)
Resume file: None
