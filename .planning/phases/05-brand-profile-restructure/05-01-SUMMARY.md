---
phase: 05-brand-profile-restructure
plan: "01"
subsystem: api
tags: [pydantic, sqlalchemy, alembic, postgres, validation]

requires: []
provides:
  - delivery_time_min/max columns on brands and products tables (migration a22c8097538a)
  - Pydantic field_validator for INN (10 or 12 digits), shipping_price >= 0, price > 0, delivery times >= 1
  - delivery_time_min/max exposed in BrandResponse and Product response schemas
  - delivery_time_min/max wired through update_brand_profile and product create routes
affects:
  - 05-brand-profile-restructure (subsequent plans that render brand profile UI)

tech-stack:
  added: []
  patterns:
    - "field_validator (Pydantic v2) used alongside existing @validator (Pydantic v1 compat) — do not convert old @validator decorators"
    - "delivery_time on product overrides brand default (None = use brand default)"

key-files:
  created:
    - packages/api/alembic/versions/a22c8097538a_add_delivery_time_to_brands_and_products.py
  modified:
    - packages/api/models.py
    - packages/api/schemas.py
    - packages/api/main.py

key-decisions:
  - "New validators use @field_validator (Pydantic v2); existing @validator decorators left untouched to preserve compat mode"
  - "delivery_time_min/max nullable on both Brand and Product; None on Product means fall back to brand default"
  - "Product update delivery_time fields handled via setattr fallthrough (already covered by generic elif field not in ['sku'] branch)"

patterns-established:
  - "field_validator pattern: @field_validator('field', mode='before') @classmethod def validate_x(cls, v)"

requirements-completed:
  - PROF-02
  - PROF-03
  - VALID-01
  - VALID-02

duration: 15min
completed: 2026-02-23
---

# Phase 05 Plan 01: DB + API Foundation Summary

**delivery_time_min/max columns added to brands/products via Alembic migration, Pydantic v2 field_validators enforce INN format, non-negative shipping price, price > 0, and delivery time >= 1 day**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-23T02:00:00Z
- **Completed:** 2026-02-23T02:15:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Added `delivery_time_min` / `delivery_time_max` (Integer, nullable) to `Brand` and `Product` ORM models
- Generated and applied Alembic migration `a22c8097538a` adding 4 columns to DB
- Added `@field_validator` on `BrandUpdate` for INN (10/12-digit), shipping_price (>= 0), min_free_shipping (>= 0), delivery_time (>= 1)
- Added `@field_validator` on `ProductCreateRequest` for price (> 0)
- Exposed `delivery_time_min/max` on `BrandResponse` and `Product` response schemas
- Wired delivery time fields through `update_brand_profile` route and product create constructor

## Task Commits

1. **Task 1: Add delivery_time columns to models** - `ba91f03` (feat)
2. **Task 2: Update Pydantic schemas with validation + delivery time fields** - `6d96915` (feat)
3. **Task 3: Wire new fields through API route + run migration** - `c398ffa` (feat)

## Files Created/Modified
- `packages/api/models.py` - delivery_time_min/max on Brand (after shipping_provider) and Product (after article_number)
- `packages/api/schemas.py` - field_validator imports, validators on BrandUpdate, delivery time fields on BrandUpdate/ProductCreateRequest/ProductUpdateRequest/BrandResponse/Product
- `packages/api/main.py` - delivery_time wired in update_brand_profile setter block and BrandResponse return; delivery_time in Product() constructor in create_product
- `packages/api/alembic/versions/a22c8097538a_add_delivery_time_to_brands_and_products.py` - migration file

## Decisions Made
- Used `@field_validator` (Pydantic v2 native) rather than `@validator` for new validators, leaving all existing `@validator` decorators untouched
- Product update route already uses generic `setattr(product, field, value)` fallthrough — delivery_time fields handled without explicit wiring

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DB foundation ready: brands and products tables have delivery_time columns
- API validates INN, prices, delivery times — 422s with Russian error messages
- Ready for 05-02 (brand profile UI) to read/write these fields

---
*Phase: 05-brand-profile-restructure*
*Completed: 2026-02-23*
