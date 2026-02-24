---
phase: 05-brand-profile-restructure
plan: "03"
subsystem: ui
tags: [react, zod, vite, frontend, validation]

requires:
  - phase: 05-01
    provides: delivery_time_min/max fields on Product model and API schema
  - phase: 05-02
    provides: parsePydanticErrors in api.ts; ApiError.fieldErrors for 422 surfacing

provides:
  - per-product delivery time override dropdowns (min/max) in AddNewItemPage
  - Zod productSchema with inline field error display
  - fieldErrors wired to API 422 responses via error.fieldErrors

affects:
  - future product form changes (pattern: Zod schema + fieldErrors state)
  - any plan touching AddNewItemPage.tsx

tech-stack:
  added: []
  patterns:
    - "Zod safeParse at submit; flatten().fieldErrors → Record<string,string> state → inline <p> under each field"
    - "Optional Select with empty-string sentinel for undefined (delivery time)"

key-files:
  created: []
  modified:
    - packages/frontend/src/pages/AddNewItemPage.tsx

key-decisions:
  - "DELIVERY_TIME_OPTIONS defined as local module-level const (no shared lib yet)"
  - "Empty string sentinel used for Select value when deliveryTimeMin/Max is undefined"
  - "Structural color-variant validations kept as toasts; only field-level errors go inline"
  - "parsePydanticErrors imported but used indirectly — api.ts sets fieldErrors on thrown ApiError"

requirements-completed:
  - PROF-03
  - VALID-01

duration: 10min
completed: 2026-02-24
---

# Phase 5 Plan 03: Frontend AddNewItemPage delivery time override + Zod validation Summary

**Per-product delivery time Min/Max Select dropdowns added to AddNewItemPage with Zod inline validation replacing toast-only error handling**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-02-24T02:10:15Z
- **Completed:** 2026-02-24T02:20:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Two optional delivery time Select dropdowns (min/max days) placed after Style selector
- `delivery_time_min` / `delivery_time_max` included in `productData` on submit; reset to `undefined` on success
- `productSchema` (Zod) replaces the old `if (!name.trim() ...)` block; inline error `<p>` under name, price, description, category
- API 422 field errors wired through `error.fieldErrors` in catch block

## Task Commits

1. **Tasks 1+2: Delivery time dropdowns + Zod inline validation** - `1ac64f4` (feat)

**Plan metadata:** (see below — docs commit)

## Files Created/Modified

- `/Users/goldp1/Polka/packages/frontend/src/pages/AddNewItemPage.tsx` - delivery time state+JSX, DELIVERY_TIME_OPTIONS, productSchema, fieldErrors state, inline error paragraphs

## Decisions Made

- Empty string used as sentinel value for undefined delivery time in Select (Radix Select requires string values)
- Color-variant structural validations (duplicate sizes, negative stock) kept as toasts — only scalar field errors go inline
- `parsePydanticErrors` imported even though called indirectly (api.ts surfaces errors via `ApiError.fieldErrors`)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AddNewItemPage now sends delivery_time_min/max to API matching 05-01 backend schema
- Zod validation pattern established; reusable for future product edit forms
- No blockers

## Self-Check: PASSED

All files present and commit verified.

---
*Phase: 05-brand-profile-restructure*
*Completed: 2026-02-24*
