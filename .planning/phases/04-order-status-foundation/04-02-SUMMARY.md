---
phase: 04-order-status-foundation
plan: 02
subsystem: api
tags: [fastapi, sqlalchemy, apscheduler, order-lifecycle, audit-log]

requires:
  - phase: 04-01
    provides: OrderStatusEvent model + Order.expires_at column + CREATED/PARTIALLY_RETURNED enum values

provides:
  - record_status_event() helper writing OrderStatusEvent rows on every status transition
  - expire_pending_orders() canceling CREATED orders past expires_at with stock restore
  - DELETE /api/v1/orders/{order_id}/cancel — buyer self-cancel (CREATED only)
  - POST /api/v1/admin/orders/{order_id}/cancel — admin force-cancel any order
  - GET /api/v1/orders/{order_id}/history — full audit trail endpoint
  - APScheduler background job running expire_pending_orders every hour
  - ADMIN_EMAIL config setting for admin identity check

affects: [04-03, 05-brand-portal, 06-order-notifications]

tech-stack:
  added: [apscheduler>=3.10.0]
  patterns:
    - "All status mutations call record_status_event() before mutating order.status"
    - "Admin identity = ADMIN_EMAIL env var match on brand auth_account.email"
    - "APScheduler BackgroundScheduler started at module load (not in startup event) for simplicity"

key-files:
  created: []
  modified:
    - packages/api/payment_service.py
    - packages/api/main.py
    - packages/api/config.py
    - packages/api/requirements.txt

key-decisions:
  - "record_status_event() does not commit — caller owns the transaction boundary"
  - "Buyer cancel rejects expired orders (expires_at < now) even if status still CREATED"
  - "Admin check uses ADMIN_EMAIL env var against brand's auth_account.email (simple, no DB column needed)"
  - "create_order_test() now starts orders at CREATED (not PENDING) then transitions to PAID via update_order_status()"

patterns-established:
  - "Audit trail pattern: every update_order_status() call auto-writes OrderStatusEvent with actor_type/actor_id/note"

requirements-completed: [ORDR-02, ORDR-03, ORDR-04]

duration: 18min
completed: 2026-02-23
---

# Phase 4 Plan 02: Order Lifecycle Endpoints Summary

**Order expiry (APScheduler hourly), buyer self-cancel, admin force-cancel, and full audit trail via record_status_event() injected into every status transition**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-02-23T17:47:50Z
- **Completed:** 2026-02-23T18:05:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- record_status_event() helper writes OrderStatusEvent row on every status mutation
- update_order_status() extended with actor_type/actor_id/note params; calls record_status_event() before mutating
- expire_pending_orders() finds CREATED orders past expires_at, cancels with stock restore, commits
- DELETE /api/v1/orders/{order_id}/cancel for buyers (CREATED status only; rejects expired)
- POST /api/v1/admin/orders/{order_id}/cancel for admin (ADMIN_EMAIL env var check)
- GET /api/v1/orders/{order_id}/history returns chronological OrderStatusEvent list
- APScheduler BackgroundScheduler runs expire job every hour on startup
- create_order_test() and create_payment() now set status=CREATED + expires_at on new orders

## Task Commits

1. **Task 1: record_status_event + expire_pending_orders + CREATED status** - `43f5726` (feat)
2. **Task 2: buyer/admin cancel endpoints + APScheduler + history endpoint** - `0affd99` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `packages/api/payment_service.py` - record_status_event(), expire_pending_orders(), update_order_status() extended, create_order_test() + create_payment() set CREATED/expires_at
- `packages/api/main.py` - _is_admin(), buyer cancel, admin cancel, history endpoints; APScheduler setup
- `packages/api/config.py` - ADMIN_EMAIL setting added
- `packages/api/requirements.txt` - apscheduler>=3.10.0 added

## Decisions Made
- record_status_event() does not call db.commit() — each endpoint owns its own transaction. Consistent with existing update_order_status() pattern.
- Buyer cancel rejects expired orders (expires_at < now) with 400 even if DB status still shows CREATED. Defensive; prevents ambiguous state.
- Admin identity check uses ADMIN_EMAIL env var matched against brand.auth_account.email. Simple, no new DB column required.
- APScheduler started at module-load level (not inside startup event) so it also works in test imports.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
Optional: set `ADMIN_EMAIL` in `packages/api/.env` to enable admin cancel endpoint (any brand whose auth email matches becomes admin).

## Next Phase Readiness
- All order lifecycle mutations now write audit events
- expire_pending_orders() ready to call from tests or manually
- Plan 03 (mobile order status UI) can proceed

## Self-Check: PASSED
- FOUND: .planning/phases/04-order-status-foundation/04-02-SUMMARY.md
- FOUND: commit 43f5726
- FOUND: commit 0affd99
