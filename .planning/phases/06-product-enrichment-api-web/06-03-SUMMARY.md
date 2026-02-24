---
phase: 06-product-enrichment-api-web
plan: "03"
subsystem: ui
tags: [react, typescript, s3, presigned-url, file-upload]

# Dependency graph
requires:
  - phase: 06-02
    provides: sale_price/sale_type in updateProduct payload + modal section
  - phase: 06-01
    provides: sizing_table_image + delivery_time fields in ProductResponse and updateProduct API
provides:
  - ProductDetailsModal sizing table image upload (S3 presigned URL, FileInput, thumbnail, remove)
  - ProductDetailsModal per-product delivery time min/max Select overrides
  - All five enrichment fields (sale_price, sale_type, sizing_table_image, delivery_time_min, delivery_time_max) included in updateProduct payload
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DELIVERY_TIME_OPTIONS local const (not imported) — same values as AddNewItemPage"
    - "Empty string sentinel for 'use brand default' delivery time (consistent with 05-03 pattern)"
    - "sizingTableImage tracks both local blob URL (preview) and http URL (existing); only http URLs sent to API"

key-files:
  created: []
  modified:
    - packages/frontend/src/components/ProductDetailsModal.tsx

key-decisions:
  - "[06-03] sizingTableImage state uses null not '' — simpler truthiness check for upload/clear logic"
  - "[06-03] DELIVERY_TIME_OPTIONS copied locally per plan — avoids import coupling between pages"
  - "[06-03] Sizing table section placed in right column above color variants; delivery time section full-width below sale section"

patterns-established:
  - "uploadOne helper reused inline for sizing table — no separate upload path needed"

requirements-completed:
  - PROD-04
  - PROD-06

# Metrics
duration: 2min
completed: 2026-02-24
---

# Phase 06 Plan 03: ProductDetailsModal Sizing Table + Delivery Time Summary

**Sizing table S3 image upload and per-product delivery time override selects wired to updateProduct in ProductDetailsModal**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-24T06:28:10Z
- **Completed:** 2026-02-24T06:29:29Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Sizing table image section with FileInput, blob preview thumbnail, and XCircle remove button in modal right column
- uploadOne helper reused for sizing table S3 upload in handleSave; finalSizingTableImage sent in updateProduct payload
- Per-product delivery time min/max Selects with DELIVERY_TIME_OPTIONS; empty string sends null to clear override

## Task Commits

1. **Task 1: Add sizing table image upload section** - `7126fae` (feat)
2. **Task 2: Add delivery time override selects** - `91dcd6f` (feat)

## Files Created/Modified
- `packages/frontend/src/components/ProductDetailsModal.tsx` - sizingTableImage/File state, deliveryTimeMin/Max state, DELIVERY_TIME_OPTIONS const, sizing table UI section, delivery time UI section, all five enrichment fields in updateProduct payload

## Decisions Made
- DELIVERY_TIME_OPTIONS defined locally (not imported from AddNewItemPage) per plan — avoids coupling
- sizingTableImage null (not '') — cleaner truthiness; only http URLs forwarded to API on save
- Sizing table section placed in right column above color variants; delivery override full-width below sale section

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All five product enrichment fields (sale_price, sale_type, sizing_table_image, delivery_time_min, delivery_time_max) now fully wired in ProductDetailsModal
- Phase 06 web portal work complete; mobile and API phases can follow
- No blockers

---
*Phase: 06-product-enrichment-api-web*
*Completed: 2026-02-24*
