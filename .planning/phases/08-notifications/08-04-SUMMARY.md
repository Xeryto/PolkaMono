---
phase: 08-notifications
plan: 04
subsystem: api, ui, notifications
tags: [expo-push, httpx, fastapi, react, typescript, notifications]

# Dependency graph
requires:
  - phase: 08-01
    provides: notification_service.create_notification(), Notification model
  - phase: 08-03
    provides: expo_push_token on User model, push registration infrastructure

provides:
  - send_expo_push_notification() via httpx to Expo Push API
  - send_buyer_shipped_notification() called on SHIPPED status in tracking endpoint
  - send_admin_broadcast_to_brands() creating in-app notifications for all active brands
  - POST /api/v1/admin/notifications/send (admin-only, 403 for others)
  - AdminNotificationsPage.tsx with textarea + send button in brand portal
  - sendAdminNotification() in frontend api.ts

affects: [09-admin, future buyer push broadcasts]

# Tech tracking
tech-stack:
  added: [httpx (already installed, now used for Expo push)]
  patterns: [fire-and-forget push with logged errors not raised, admin identity via _is_admin() helper]

key-files:
  created:
    - packages/frontend/src/pages/AdminNotificationsPage.tsx
  modified:
    - packages/api/notification_service.py
    - packages/api/main.py
    - packages/frontend/src/pages/Dashboard.tsx
    - packages/frontend/src/components/DashboardSidebar.tsx
    - packages/frontend/src/services/api.ts

key-decisions:
  - "[08-04] send_expo_push_notification() is fire-and-forget: errors logged via print(), not raised — prevents SHIPPED update from failing due to push errors"
  - "[08-04] SHIPPED hook uses order.user_id directly (denormalized field) — no Checkout query needed"
  - "[08-04] Admin broadcast uses existing _is_admin() helper (ADMIN_EMAIL env match) — no new auth mechanism"
  - "[08-04] Admin notifications to brands are in-app only — brands are web users with no Expo push tokens; buyer push broadcast deferred to ADMIN-04 Phase 9"
  - "[08-04] Sidebar shows Рассылка (Админ) to all brands — server returns 403 for non-admin (simpler than frontend admin check)"

patterns-established:
  - "Push delivery: validate ExponentPushToken prefix before sending, swallow exceptions"
  - "Admin broadcast: query Brand WHERE is_inactive=False, create_notification per brand"

requirements-completed: [NOTIF-04, NOTIF-06]

# Metrics
duration: 15min
completed: 2026-02-24
---

# Phase 8 Plan 04: Expo Push + Admin Broadcast Summary

**Buyer push on SHIPPED via httpx to Expo Push API, admin in-app broadcast to all brands via portal UI**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-24T13:00:00Z
- **Completed:** 2026-02-24T13:15:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- `send_expo_push_notification()` fires to Expo's push API via httpx (fire-and-forget, errors logged)
- SHIPPED status trigger: tracking update endpoint now calls `send_buyer_shipped_notification()` when order transitions from PAID to SHIPPED
- `POST /api/v1/admin/notifications/send` creates in-app notifications for all active brands (403 for non-admin)
- AdminNotificationsPage in brand portal: textarea, char counter, send button, success/error feedback
- DashboardSidebar "Рассылка (Админ)" nav item navigating to admin-notifications view

## Task Commits

1. **Task 1: Expo push delivery + SHIPPED trigger + admin broadcast API** - `7bae0e6` (feat)
2. **Task 2: Admin notifications UI in brand portal** - `b6262ef` (feat)

## Files Created/Modified
- `packages/api/notification_service.py` — added EXPO_PUSH_URL, send_expo_push_notification(), send_buyer_shipped_notification(), send_admin_broadcast_to_brands()
- `packages/api/main.py` — SHIPPED hook in update_order_tracking, AdminNotificationSend schema, POST /api/v1/admin/notifications/send endpoint
- `packages/frontend/src/pages/AdminNotificationsPage.tsx` — new admin broadcast UI
- `packages/frontend/src/pages/Dashboard.tsx` — admin-notifications view wired
- `packages/frontend/src/components/DashboardSidebar.tsx` — Bell icon + Рассылка (Админ) nav item
- `packages/frontend/src/services/api.ts` — sendAdminNotification() function

## Decisions Made
- fire-and-forget push: errors logged not raised so SHIPPED update never fails due to push service outage
- Used `order.user_id` directly (denormalized on Order) to avoid extra Checkout query
- Reused `_is_admin()` for admin endpoint guard — consistent with existing admin cancel endpoints
- Sidebar shows admin item to all brands; server enforces 403 — simpler than frontend admin detection

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required beyond existing EXPO_PUBLIC_API_URL and ADMIN_EMAIL env vars.

## Next Phase Readiness
- Phase 8 notifications fully complete: in-app bell (08-01/02), push infrastructure (08-03), shipped push + admin broadcast (08-04)
- Phase 9 (admin) can build on admin broadcast pattern for ADMIN-04 buyer push broadcasts
- expo_push_token on User + send_expo_push_notification() available for any future push trigger

---
*Phase: 08-notifications*
*Completed: 2026-02-24*
