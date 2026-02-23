---
phase: 04-order-status-foundation
plan: 03
subsystem: api+frontend
tags: [fastapi, pydantic, react, typescript, order-status, brand-portal]

requires:
  - phase: 04-01
    provides: OrderStatus enum with CREATED/PARTIALLY_RETURNED values
  - phase: 04-02
    provides: order lifecycle mutations with audit trail

provides:
  - shipping_cost field in OrderSummaryResponse (API list endpoint)
  - _order_to_summary() and _checkout_to_summary() populate shipping_cost
  - OrderSummary TS interface with shipping_cost?: number
  - ORDER_STATUS const with 7 keys (CREATED + PARTIALLY_RETURNED added)
  - Russian labels for created/partially_returned statuses
  - Distinct badge colors for created (slate) and partially_returned (orange)
  - OrdersView renders "Доставка: X ₽" per order row when shipping_cost > 0

affects: [05-brand-portal, 06-order-notifications]

tech-stack:
  added: []
  patterns:
    - "OrderSummaryResponse is the shared list-view type for both brand (Order) and buyer (Checkout) paths"
    - "Status helpers (labels/colors) centralized in orderStatus.ts; all clients import from there"

key-files:
  created: []
  modified:
    - packages/api/schemas.py
    - packages/api/main.py
    - packages/frontend/src/services/api.ts
    - packages/frontend/src/lib/orderStatus.ts
    - packages/frontend/src/components/OrdersView.tsx

key-decisions:
  - "_checkout_to_summary() sums shipping_cost across child orders — gives buyer total delivery visibility"
  - "shipping_cost optional (?: number) in TS OrderSummary so old cached responses don't break"
  - "ORDER_STATUS CREATED/PARTIALLY_RETURNED added as string literals consistent with existing keys"

requirements-completed: [ORDR-01, ORDR-05]

duration: 6min
completed: 2026-02-23
---

# Phase 4 Plan 03: Delivery Cost + Status Display Summary

**Shipping cost surfaced in brand portal order list; created and partially_returned statuses now labeled and colored in frontend**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-23T17:51:51Z
- **Completed:** 2026-02-23T17:57:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- OrderSummaryResponse gains `shipping_cost: float = 0.0` field
- `_order_to_summary()` reads `order.shipping_cost` and passes it through
- `_checkout_to_summary()` sums shipping across all child orders for buyer view
- Frontend `OrderSummary` interface adds `shipping_cost?: number`
- `ORDER_STATUS` const now has 7 keys: CREATED, PENDING, PAID, SHIPPED, RETURNED, PARTIALLY_RETURNED, CANCELED
- `getOrderStatusLabel()` returns "создан" / "частично возвращён" for new statuses
- `getOrderStatusColor()` returns slate badge for created, orange badge for partially_returned
- `OrdersView` renders "Доставка: {amount}" line under total when shipping_cost > 0

## Task Commits

1. **Task 1: Add shipping_cost to OrderSummaryResponse and _order_to_summary** - `c5e0103` (feat)
2. **Task 2: Update frontend types, status helpers, and OrdersView** - `05bc9f4` (feat)

## Files Created/Modified

- `packages/api/schemas.py` — OrderSummaryResponse gains shipping_cost field
- `packages/api/main.py` — _order_to_summary() + _checkout_to_summary() populate shipping_cost
- `packages/frontend/src/services/api.ts` — OrderSummary.shipping_cost?: number
- `packages/frontend/src/lib/orderStatus.ts` — 7-key ORDER_STATUS const, labels + colors for new statuses
- `packages/frontend/src/components/OrdersView.tsx` — Доставка line per order

## Decisions Made

- `_checkout_to_summary()` sums shipping_cost across all child orders. Buyer sees total delivery cost for the whole checkout rather than just the first order's.
- `shipping_cost` is optional (`?: number`) in the TS interface so clients not yet updated don't break on deserialization.
- New statuses added as consistent string-literal constants in ORDER_STATUS (not a separate union type).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- GET /api/v1/orders now returns shipping_cost per order
- Brand portal OrdersView shows delivery cost inline
- All 7 order statuses handled in frontend badge system
- Phase 5 (brand portal enhancements) can proceed

## Self-Check: PASSED

- FOUND: packages/api/schemas.py — shipping_cost field
- FOUND: packages/api/main.py — shipping_cost=float(order.shipping_cost or 0.0)
- FOUND: packages/frontend/src/lib/orderStatus.ts — partially_returned
- FOUND: packages/frontend/src/components/OrdersView.tsx — shipping_cost
- FOUND: commit c5e0103
- FOUND: commit 05bc9f4
