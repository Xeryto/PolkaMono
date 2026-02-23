---
phase: 04-order-status-foundation
plan: 01
subsystem: database
tags: [postgres, sqlalchemy, alembic, order-status, audit-log]

requires: []
provides:
  - OrderStatus enum with CREATED and PARTIALLY_RETURNED values
  - Order.expires_at nullable column in model and DB
  - OrderStatusEvent audit log model and table (FK to orders)
  - ORDER_PENDING_EXPIRY_HOURS=24 config setting
  - Alembic migration 04_order_status_foundation applied as head
affects: [04-02, 04-03, 05-brand-portal, 06-order-notifications]

tech-stack:
  added: []
  patterns:
    - "OrderStatusType TypeDecorator maps enum to VARCHAR; new values added as lowercase strings"
    - "Migration guards on orderstatus enum: skipped if column is plain VARCHAR"

key-files:
  created:
    - packages/api/alembic/versions/04_order_status_foundation.py
  modified:
    - packages/api/models.py
    - packages/api/schemas.py
    - packages/api/config.py

key-decisions:
  - "Migration skips ALTER TYPE orderstatus because orders.status is VARCHAR not a PG enum"
  - "OrderStatusEvent uses String PK (UUID) for consistency with rest of models"
  - "expires_at nullable; set at order creation time for CREATED/PENDING orders"

patterns-established:
  - "Audit log pattern: OrderStatusEvent records every transition with actor_type/actor_id/note"

requirements-completed: [ORDR-01, ORDR-02]

duration: 18min
completed: 2026-02-23
---

# Phase 4 Plan 01: Order Status Foundation Summary

**OrderStatus enum extended to 7 values (CREATED, PARTIALLY_RETURNED added), Order.expires_at column and OrderStatusEvent audit table created via Alembic migration**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-02-23T12:30:00Z
- **Completed:** 2026-02-23T12:48:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended OrderStatus enum and _ORDER_STATUS_TO_DB dict with CREATED and PARTIALLY_RETURNED
- Added Order.expires_at nullable column and status_events relationship
- Added OrderStatusEvent model (audit log: id, order_id FK, from_status, to_status, actor_type, actor_id, note, created_at)
- Added ORDER_PENDING_EXPIRY_HOURS = 24 to Settings
- Updated ORDER_STATUS_VALUES in schemas.py to include both new statuses
- Created and applied Alembic migration 04_order_status_foundation (now head)

## Task Commits

1. **Task 1: Extend Order model** - `ddadcd9` (feat)
2. **Task 2: Config, schema, migration** - `18a8c91` (feat)

## Files Created/Modified
- `packages/api/models.py` - OrderStatus enum extended; Order.expires_at + status_events; OrderStatusEvent model added
- `packages/api/config.py` - ORDER_PENDING_EXPIRY_HOURS setting added
- `packages/api/schemas.py` - ORDER_STATUS_VALUES updated to 7 values
- `packages/api/alembic/versions/04_order_status_foundation.py` - Migration: expires_at column, order_status_events table, index

## Decisions Made
- Migration guards the ALTER TYPE call behind a pg_type existence check — orders.status is VARCHAR in this DB, not a native PG enum, so the ALTER is skipped cleanly.
- OrderStatusEvent uses auto-generated UUID string PK (consistent with Order, OrderItem, etc.).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration fixed to guard ALTER TYPE orderstatus**
- **Found during:** Task 2 (Alembic migration)
- **Issue:** Plan specified `ALTER TYPE orderstatus ADD VALUE IF NOT EXISTS` but the DB uses VARCHAR for orders.status — the orderstatus pg enum type does not exist, causing UndefinedObject error
- **Fix:** Wrapped ALTER TYPE in `SELECT 1 FROM pg_type WHERE typname = 'orderstatus'` guard (matching pattern from existing `add_order_status_shipped_returned.py`); also fixed create_table order (table before column) to avoid DuplicateTable from partial first run
- **Files modified:** packages/api/alembic/versions/04_order_status_foundation.py
- **Verification:** `alembic upgrade head` exits 0; `alembic current` shows 04_order_status_foundation (head)
- **Committed in:** 18a8c91 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug in migration SQL)
**Impact on plan:** Fix necessary for correct migration execution. No scope change.

## Issues Encountered
- First migration run partially executed (create_table succeeded before transaction rolled back on ALTER TYPE). Dropped the orphaned table manually before re-running cleanly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB schema fully ready: expires_at on orders, order_status_events table live
- All model imports verified error-free
- Plans 02 and 03 (API endpoints, mobile UI) can proceed
