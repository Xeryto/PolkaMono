---
phase: 05-brand-profile-restructure
plan: "02"
subsystem: ui
tags: [react, zod, shadcn, dialog, select, validation, frontend]

requires:
  - phase: 05-01
    provides: delivery_time_min/max columns on Brand model + API validators

provides:
  - Read-only legal info Dialog modal (INN/address/payout_account) behind "Просмотреть реквизиты" button
  - Delivery section with shipping_price, min_free_shipping, delivery_time_min/max Select dropdowns
  - Zod inline validation with per-field error messages in ProfileSettingsPage
  - parsePydanticErrors utility for 422 field error mapping in api.ts

affects:
  - Any future plan touching ProfileSettingsPage or api.ts BrandResponse/BrandProfileUpdateRequest

tech-stack:
  added: [zod (already in package.json, now used in ProfileSettingsPage)]
  patterns:
    - "Zod safeParse + flatten().fieldErrors for inline form validation (no RHF)"
    - "parsePydanticErrors maps FastAPI 422 detail array to field->message Record"
    - "ApiError.fieldErrors property carries server-side field errors to UI"

key-files:
  created: []
  modified:
    - packages/frontend/src/services/api.ts
    - packages/frontend/src/pages/ProfileSettingsPage.tsx

key-decisions:
  - "Legal fields (INN/address/payout_account) are read-only modal only — no edit path in brand portal"
  - "payout_account_locked checkbox/lock UI removed entirely; admin-only field not exposed to brands"
  - "handleInputChange clears per-field error on change for responsive UX"
  - "Admin-only fields (inn, registration_address, payout_account, payout_account_locked) excluded from save payload"

patterns-established:
  - "Inline field errors: {fieldErrors.fieldName && <p className='text-xs text-destructive mt-1'>} pattern"
  - "parsePydanticErrors in api.ts + ApiError.fieldErrors enables server validation surfacing"

requirements-completed: [PROF-01, PROF-02, VALID-01, VALID-02]

duration: 15min
completed: 2026-02-24
---

# Phase 05 Plan 02: Frontend ProfileSettingsPage Restructure Summary

**Read-only legal info Dialog modal + Zod inline validation + delivery_time range selects in brand portal ProfileSettingsPage**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-24T01:53:00Z
- **Completed:** 2026-02-24T02:08:19Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Moved INN/address/payout_account out of inline edit form into view-only shadcn Dialog modal
- Added full delivery section: shipping_price, min_free_shipping, delivery_time_min/max Select dropdowns, shipping_provider
- Added Zod schema validation with inline per-field error messages; 422 API errors also surface inline
- Added parsePydanticErrors utility + ApiError.fieldErrors to api.ts for server error propagation
- Removed stale React component imports from api.ts service module (Dialog, Label, Badge, self-import, etc.)

## Task Commits

1. **Task 1: api.ts — parsePydanticErrors + delivery_time fields** - `d7d08f6` (feat)
2. **Task 2: ProfileSettingsPage restructure** - `f919203` (feat)

## Files Created/Modified

- `packages/frontend/src/services/api.ts` — removed stale imports; added delivery_time_min/max to BrandResponse + BrandProfileUpdateRequest; added parsePydanticErrors export; added fieldErrors to ApiError; updated handleApiResponse to set fieldErrors on 422
- `packages/frontend/src/pages/ProfileSettingsPage.tsx` — replaced inline legal fields with modal button; added delivery section with Select dropdowns; added Zod validation; removed Checkbox/Lock imports and payout_account_locked UI

## Decisions Made

- Legal fields are permanently view-only from brand side — no unlock flow needed in frontend
- payout_account_locked removed from UI entirely (plan confirmation)
- Inline error cleared on field change for responsive UX (deviation from plan spec, but obvious UX improvement — Rule 2)
- Cancel button also clears fieldErrors to avoid stale error display

## Deviations from Plan

None — plan executed exactly as written, plus one small UX addition (clearing fieldErrors on cancel and per-field-change) which falls under Rule 2 (missing critical UX correctness).

## Issues Encountered

None — TypeScript compiled cleanly on first attempt.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- ProfileSettingsPage fully restructured; legal modal read-only, delivery section complete
- 05-03 (if it exists) can build on the Zod validation pattern established here
- parsePydanticErrors available globally for any other form pages needing 422 error handling

---
*Phase: 05-brand-profile-restructure*
*Completed: 2026-02-24*
