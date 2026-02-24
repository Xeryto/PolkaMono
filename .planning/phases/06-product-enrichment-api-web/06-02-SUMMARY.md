---
phase: 06-product-enrichment-api-web
plan: "02"
subsystem: ui
tags: [react, typescript, vite, shadcn, sale, discount]

requires:
  - phase: 06-01
    provides: sale_price/sale_type/sizing_table_image columns on Product + API returning them

provides:
  - ProductDetailsModal sale section: percent/exact type selector + conditional price input wired to updateProduct
  - ProductsView sale badge (red pill) per product row when sale_price != null
  - ProductsView remove-sale button that sends sale_price:null/sale_type:null to clear the sale
  - ProductResponse interface has sale_price, sale_type, sizing_table_image, delivery_time_min/max
  - updateProduct param type accepts all enrichment fields with explicit null (not just undefined) for clearing

affects:
  - 06-03 (web sizing table image upload — uses same updateProduct extension pattern)
  - future mobile sale display (same field names)

tech-stack:
  added: []
  patterns:
    - "Send explicit null (not undefined) in JSON payload to clear nullable DB fields — undefined is omitted by JSON.stringify"
    - "Empty string sentinel '' for Radix Select when no value selected; convert '' -> null before API call"

key-files:
  created: []
  modified:
    - packages/frontend/src/services/api.ts
    - packages/frontend/src/components/ProductDetailsModal.tsx
    - packages/frontend/src/components/ProductsView.tsx

key-decisions:
  - "[06-02] sale_price/sale_type use null not undefined in updateProduct param type so JSON.stringify includes the clear signal"
  - "[06-02] saleType state uses '' as the no-sale sentinel; converted to null on save so API receives null to clear"
  - "[06-02] Remove-sale button uses e.stopPropagation() to prevent modal open on row click"

requirements-completed: [PROD-01, PROD-03]

duration: 2min
completed: 2026-02-24
---

# Phase 06 Plan 02: Sale Price UI (Web Portal) Summary

**Sale section in ProductDetailsModal (percent/exact type + price input with live preview) and per-product sale badge + remove button in ProductsView, all wired to updateProduct with null-clearing semantics**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-24T12:04:55Z
- **Completed:** 2026-02-24T12:06:35Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- ProductResponse interface extended with sale_price, sale_type, sizing_table_image, delivery_time_min/max
- updateProduct param type extended with same fields using `| null` (not just `?`) so null is serialized by JSON.stringify
- ProductDetailsModal gets a "Скидка" section: Select for type (none/percent/exact) + conditional Input for amount; percent type shows live discounted price preview
- ProductsView shows red pill badge per product row (e.g. "-20%" or "1 490 ₽") and "Убрать скидку" link; clicking link sends {sale_price: null, sale_type: null} and refreshes list

## Task Commits

1. **Task 1: Add sale_price/sale_type to ProductResponse + updateProduct** - `1e54a71` (feat)
2. **Task 2: Sale section in ProductDetailsModal** - `778d080` (feat)
3. **Task 3: Sale badge + remove button in ProductsView** - `cd3835d` (feat)

## Files Created/Modified
- `packages/frontend/src/services/api.ts` - ProductResponse + updateProduct extended with sale/enrichment fields
- `packages/frontend/src/components/ProductDetailsModal.tsx` - sale section UI + state + handleSave wiring
- `packages/frontend/src/components/ProductsView.tsx` - handleRemoveSale handler + badge/button JSX

## Decisions Made
- Explicit `null` in updateProduct param types (not just `?`): ensures JSON.stringify includes the null when clearing a sale
- Empty string `''` as saleType sentinel for Radix Select "no selection"; converted to null before API call (consistent with [05-03] delivery time pattern)
- `e.stopPropagation()` on remove button to prevent row click from opening the edit modal

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sale UI fully functional for brand portal web — set and remove sale via modal or list button
- 06-03 can add sizing table image upload using the same updateProduct extension pattern already established

---
*Phase: 06-product-enrichment-api-web*
*Completed: 2026-02-24*
