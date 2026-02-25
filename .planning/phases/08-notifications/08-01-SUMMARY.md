---
phase: 08-notifications
plan: 01
subsystem: api
tags: [notifications, backend, database, migration]
dependency_graph:
  requires: []
  provides: [notification-db-model, notification-service, brand-notification-api]
  affects: [payment-webhook, test-order-endpoint]
tech_stack:
  added: [notification_service.py]
  patterns: [service-module, pydantic-response-schema]
key_files:
  created:
    - packages/api/notification_service.py
    - packages/api/alembic/versions/08_notifications.py
  modified:
    - packages/api/models.py
    - packages/api/schemas.py
    - packages/api/main.py
decisions:
  - "Migration uses IF NOT EXISTS guard — table already existed in DB from prior attempt; idempotent upgrade avoids error"
  - "notification_service.py uses Optional[str] not str|None (Python 3.9 compat)"
  - "Test order notifications fired in endpoint after create_order_test() returns, querying checkout orders by checkout_id"
  - "Webhook notification fires before final db.commit() via send_brand_new_order_notification which self-commits"
metrics:
  duration: 10m
  completed_date: 2026-02-25
  tasks_completed: 2
  files_modified: 5
---

# Phase 08 Plan 01: Notification Backend Foundation Summary

Notification DB model, Alembic migration, notification_service.py, Pydantic schemas, and brand notification REST endpoints wired to payment confirmation events.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Notification ORM model + Alembic migration | a74dbbb | models.py, alembic/versions/08_notifications.py |
| 2 | notification_service + schemas + API endpoints + payment wiring | c849219 | notification_service.py, schemas.py, main.py |

## What Was Built

**Notification ORM Model** (`models.py`): `Notification` class with `id` (UUID), `recipient_type` (brand/user), `recipient_id`, `type` (new_order/return_logged/admin_custom), `message`, `order_id`, `is_read`, `expires_at`, `created_at`.

**Alembic Migration** (`08_notifications.py`): `CREATE TABLE IF NOT EXISTS notifications` with index on `recipient_id`. Chains from `07_account_management_2fa`. Applied successfully; DB is now at head `08_notifications`.

**notification_service.py**: `create_notification()` — generic notification writer; `send_brand_new_order_notification()` — fires `new_order` type with Russian message; `send_return_logged_notification()` — for future return flow.

**Pydantic Schemas**: `NotificationItem` (id, type, message, order_id, is_read, created_at) + `NotificationsResponse` (notifications list + unread_count).

**GET /api/v1/notifications/** (brand JWT required): Returns up to 20 non-expired notifications for the brand, ordered by `created_at desc`, with `unread_count`.

**POST /api/v1/notifications/read** (brand JWT required): Bulk-marks all unread non-expired brand notifications as `is_read=True`. Returns 204.

**Payment webhook wiring**: After `update_order_status(PAID)`, queries the order for `brand_id` and calls `send_brand_new_order_notification()`.

**Test order wiring**: After `create_order_test()`, queries all orders in the returned checkout and fires `send_brand_new_order_notification()` for each brand.

## Deviations from Plan

**1. [Rule 1 - Bug] Migration idempotency guard**
- Found during: Task 1
- Issue: `notifications` table already existed in DB from a prior untracked migration; bare `op.create_table` raised `DuplicateTable`
- Fix: Rewrote migration to use raw SQL `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`
- Files modified: packages/api/alembic/versions/08_notifications.py
- Commit: a74dbbb

**2. [Rule 1 - Bug] Python 3.9 union syntax**
- Found during: Task 2
- Issue: `str | None` union syntax (PEP 604) requires Python 3.10+; venv is 3.9
- Fix: Replaced with `Optional[str]` and added `from typing import Optional` import
- Files modified: packages/api/notification_service.py
- Commit: c849219

## Verification

- `notifications` table: exists with all 9 expected columns
- Alembic head: `08_notifications`
- Routes registered: `/api/v1/notifications/`, `/api/v1/notifications/read`
- `schemas.NotificationItem` fields: id, type, message, order_id, is_read, created_at
- `schemas.NotificationsResponse` fields: notifications, unread_count
- `main.py` imports cleanly with no errors

## Self-Check: PASSED
