---
phase: quick-3
plan: 01
subsystem: api
tags: [security, auth, authorization, payment]
dependency_graph:
  requires: []
  provides: [brand-ownership-enforcement, no-jwt-leak]
  affects: [packages/api/main.py]
tech_stack:
  added: []
  patterns: [ownership-guard, attacker-controlled-field-removal]
key_files:
  created: []
  modified:
    - packages/api/main.py
decisions:
  - "Use current_user.id for brand_id in create_product — never trust client-supplied field"
  - "Remove brand DB query in create_product — current_user IS the brand, no lookup needed"
  - "Remove request param from create_payment_endpoint entirely — was only needed for debug prints"
metrics:
  duration: ~5min
  completed: 2026-02-23T18:30:36Z
  tasks_completed: 3
  files_modified: 1
---

# Quick Task 3: Fix 3 Security Vulnerabilities Summary

One-liner: Three fixes in main.py — brand ownership guard on update, brand_id forced to current_user.id on create, and JWT-leaking debug prints removed from payment endpoint.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Enforce brand ownership in update_product (403 on mismatch) | dd0f904 |
| 2 | Prevent brand impersonation in create_product (use current_user.id) | 94f9108 |
| 3 | Remove JWT-leaking debug prints from create_payment_endpoint | ec99c95 |

## Changes Made

### Task 1 — update_product ownership bypass (HIGH)

`update_product` had a comment "Ensure the product belongs to the current brand user (if applicable)" but only checked that a brand existed for the product — it never verified the brand was the authenticated caller. Any brand could update any other brand's product.

Fix: replaced the no-op brand lookup with `if product.brand_id != current_user.id: raise HTTPException(403)`.

### Task 2 — create_product brand impersonation (HIGH)

`create_product` used `brand_id=product_data.brand_id` in the Product constructor, meaning any authenticated brand could create products under any other brand's ID by passing an arbitrary `brand_id` in the request body.

Fix: changed to `brand_id=current_user.id`. Also removed the now-unnecessary `db.query(Brand).filter(Brand.id == product_data.brand_id)` lookup (3 lines) and replaced the two `brand.name` references inside article number generation with `current_user.name`.

### Task 3 — JWT leak in create_payment_endpoint (MEDIUM)

The payment endpoint printed `request.headers` to stdout on every request, exposing `Authorization: Bearer <token>` in server logs/console.

Fix: removed `print("Entered create_payment_endpoint")`, `print(f"Request headers: {request.headers}")`, the `raw_request_body = await request.body()` line and its print. Also removed `request: Request` from the function signature since it was only needed for those prints.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- packages/api/main.py: FOUND
- Commit dd0f904: FOUND
- Commit 94f9108: FOUND
- Commit ec99c95: FOUND
- `brand_id=product_data.brand_id`: 0 results (good)
- `Request headers` print: 0 results (good)
- `Product does not belong to your brand` at line 1760: FOUND
- Syntax check: OK

## Self-Check: PASSED
