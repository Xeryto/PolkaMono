---
phase: 08-notifications
plan: "02"
subsystem: frontend
tags: [notifications, bell, dashboard, orders, polling]
dependency_graph:
  requires: [08-01]
  provides: [notification-bell-ui, order-targeted-navigation]
  affects: [DashboardHeader, Dashboard, OrdersView]
tech_stack:
  added: []
  patterns: [radix-dropdown, polling-interval, scroll-into-view, css-class-highlight]
key_files:
  created: []
  modified:
    - packages/frontend/src/services/api.ts
    - packages/frontend/src/components/DashboardHeader.tsx
    - packages/frontend/src/pages/Dashboard.tsx
    - packages/frontend/src/components/OrdersView.tsx
decisions:
  - fetchNotifications/markNotificationsRead use apiRequest helper (token param pattern) not raw fetch
  - markNotificationsRead called with token from useAuth, not localStorage direct
  - onTargetOrder propagated via props (not context) — simpler, avoids extra context overhead
metrics:
  duration: "2m17s"
  completed: "2026-02-25"
  tasks: 2
  files: 4
---

# Phase 8 Plan 02: Notification Bell UI Summary

**One-liner:** Functional notification bell in DashboardHeader with unread badge, dropdown list, mark-read on open, and order-targeted navigation with scroll/highlight in OrdersView.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add fetchNotifications and markNotificationsRead to api.ts | 61766fb | api.ts |
| 2 | DashboardHeader bell + Dashboard targetOrderId + OrdersView scroll | 5448746 | DashboardHeader.tsx, Dashboard.tsx, OrdersView.tsx |

## What Was Built

**api.ts additions:**
- `NotificationItem` and `NotificationsResponse` interfaces
- `fetchNotifications(token)` — GET /api/v1/notifications/
- `markNotificationsRead(token)` — POST /api/v1/notifications/read

**DashboardHeader.tsx:**
- Replaced static Bell button with Radix DropdownMenu wrapping it
- Unread badge (red pill, capped at 99+) shown when `unread_count > 0`
- `loadNotifications` on mount + 30s polling interval
- `handleBellOpen` fires `markNotificationsRead()` on open if unread > 0, clears badge optimistically
- Dropdown lists notifications with type icon (ShoppingBag / Package / AlertCircle), message, relative timestamp
- Empty state: "Нет уведомлений"
- Clicking item: `onTargetOrder(order_id)` + `onViewChange("orders")`
- Added `onTargetOrder` prop to `DashboardHeaderProps`

**Dashboard.tsx:**
- Added `targetOrderId` state (`string | null`)
- Passes `onTargetOrder={setTargetOrderId}` to DashboardHeader
- Passes `targetOrderId` and `onTargetConsumed={() => setTargetOrderId(null)}` to OrdersView

**OrdersView.tsx:**
- Added `targetOrderId?` and `onTargetConsumed?` props
- Added `data-order-id={order.id}` to each order row div
- `useEffect([targetOrderId])`: scrolls to row with smooth behavior, adds `ring-2 ring-brown-light transition-all`, removes after 2s, calls `onTargetConsumed`

## Deviations from Plan

**1. [Rule 2 - Pattern] fetchNotifications uses apiRequest not raw fetch**
- **Found during:** Task 1
- **Issue:** Plan showed raw `fetch` with `localStorage.getItem('authToken')`. The existing api.ts pattern passes token as parameter to `apiRequest` helper which handles auth headers, timeout, retry, and 401 dispatch.
- **Fix:** Used `apiRequest` with token param, matching every other API function in the file.
- **Files modified:** api.ts

None other — plan executed with one minor pattern alignment.

## Self-Check: PASSED
