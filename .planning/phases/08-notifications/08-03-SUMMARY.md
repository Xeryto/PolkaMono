---
phase: 08-notifications
plan: 03
subsystem: notifications
tags: [expo-notifications, push-notifications, react-native, fastapi, alembic, postgres]

requires:
  - phase: 08-01
    provides: Notification backend + notification_service.py foundation

provides:
  - expo-notifications SDK installed and configured in mobile app
  - expo_push_token column on users table (migration 08b_push_token)
  - POST /api/v1/users/push-token endpoint stores token for authenticated user
  - registerForPushNotificationsAsync() requests permission + fetches Expo push token
  - Fire-and-forget token registration after all login/register/email-verify paths to main
  - Notification tap listener navigates to Wall screen with openOrderId param
  - navigationRef lifted to AppContent scope for cross-component navigation

affects: [08-04-buyer-notification-ui, NOTIF-06]

tech-stack:
  added: [expo-notifications@0.32.16, expo-device@8.0.10]
  patterns:
    - Fire-and-forget push token registration (triggerPushRegistration helper)
    - Deferred tap navigation via pendingOrderIdRef for cold-start safety
    - navigationRef lifted to AppContent; passed down as optional prop to MainAppNavigator

key-files:
  created:
    - packages/api/alembic/versions/08b_push_token.py
  modified:
    - packages/mobile/App.tsx
    - packages/mobile/app/services/api.ts
    - packages/mobile/app.json
    - packages/mobile/package.json
    - packages/api/models.py
    - packages/api/main.py

key-decisions:
  - "[08-03] app.json notification icon uses ./app/assets/icon.png fallback (no separate notification-icon.png)"
  - "[08-03] setNotificationHandler uses shouldShowBanner+shouldShowList (SDK 0.32 API; shouldShowAlert is deprecated)"
  - "[08-03] triggerPushRegistration() helper centralizes fire-and-forget pattern; called at all transitionTo(main) sites in handleLogin/handleRegister/handleEmailVerificationSuccess"
  - "[08-03] navigationRef lifted to AppContent as mainNavigationRef; MainAppNavigator accepts optional navigationRef prop, falls back to internal ref"
  - "[08-03] Tap listener uses openOrderId param on Wall navigate; receiving screen integration deferred to 08-04"

requirements-completed: [NOTIF-05]

duration: 30min
completed: 2026-02-24
---

# Phase 8 Plan 3: Push Notification Infrastructure Summary

**expo-notifications installed, Expo push token registration flow wired in App.tsx, expo_push_token on User model, POST /api/v1/users/push-token endpoint, and tap-to-navigate listener using deferred pendingOrderIdRef**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-02-24T21:30:00Z
- **Completed:** 2026-02-24T22:00:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- expo-notifications + expo-device installed (SDK 54 compat via `npx expo install`)
- app.json updated with expo-notifications plugin
- User.expo_push_token column added via 08b_push_token migration (applied to DB)
- POST /api/v1/users/push-token endpoint returns 204, guards against brand accounts
- registerForPushNotificationsAsync() in App.tsx handles permission request + token fetch + Android channel
- triggerPushRegistration() fire-and-forget called after all transitionTo("main") paths
- Notification tap listener navigates to Wall with openOrderId (immediate if in main, deferred otherwise)

## Task Commits

1. **Task 1: Install expo-notifications + DB column + API endpoint** - `1627bcf` (feat)
2. **Task 2: Push token registration + tap navigation in App.tsx + api.ts** - `60491a8` (feat)

## Files Created/Modified
- `packages/mobile/App.tsx` - push registration helper, notification handler, tap listener, mainNavigationRef lift
- `packages/mobile/app/services/api.ts` - registerPushToken() function
- `packages/mobile/app.json` - expo-notifications plugin config
- `packages/mobile/package.json` - expo-notifications + expo-device added
- `packages/api/models.py` - User.expo_push_token column
- `packages/api/main.py` - PushTokenUpdate schema + POST /api/v1/users/push-token
- `packages/api/alembic/versions/08b_push_token.py` - migration (applied)

## Decisions Made
- app.json notification icon uses `./app/assets/icon.png` fallback (no separate notification-icon.png exists)
- setNotificationHandler uses `shouldShowBanner`+`shouldShowList` (SDK 0.32 deprecated `shouldShowAlert`)
- `triggerPushRegistration()` helper centralizes fire-and-forget pattern at all login paths
- `mainNavigationRef` lifted to `AppContent`; `MainAppNavigator` accepts optional `navigationRef` prop
- Tap listener passes `openOrderId` param to Wall; receiving screen integration deferred to 08-04

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed NotificationBehavior type: shouldShowAlert deprecated in SDK 0.32**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `shouldShowAlert: true` caused TS2322 error; `NotificationBehavior` in expo-notifications 0.32 requires `shouldShowBanner` + `shouldShowList`
- **Fix:** Replaced `shouldShowAlert` with `shouldShowBanner: true, shouldShowList: true`
- **Files modified:** packages/mobile/App.tsx
- **Verification:** `npx tsc --noEmit` passes with no errors in App.tsx or api.ts
- **Committed in:** `60491a8` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for SDK 0.32 compatibility. No scope creep.

## Issues Encountered
None beyond the TypeScript fix above.

## Next Phase Readiness
- Push infrastructure complete; buyer receives push notification on order status change (NOTIF-06)
- 08-04 will wire WallPage to receive `openOrderId` param and open the correct order
- `expo_push_token` is now in DB and populated on first login after this deploy

---
*Phase: 08-notifications*
*Completed: 2026-02-24*

## Self-Check: PASSED

- `packages/api/alembic/versions/08b_push_token.py` — FOUND
- `packages/mobile/node_modules/expo-notifications/build/index.d.ts` — FOUND (types ok)
- Task 1 commit `1627bcf` — FOUND
- Task 2 commit `60491a8` — FOUND
