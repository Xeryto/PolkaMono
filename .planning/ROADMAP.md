# Roadmap: Polka

## Milestones

- ✅ **v1.0 Theme & Dark Mode** - Phases 1-3 (Phases 1-2 complete; Phase 3 deferred to v1.2)
- 🚧 **v1.1 Website Completion** - Phases 4-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Theme & Dark Mode (Phases 1-2 complete; Phase 3 deferred)</summary>

### Phase 1: Light Mode Fixes
**Goal**: Known broken spots in light mode are corrected and on-brand
**Depends on**: Nothing (first phase)
**Requirements**: LIGHT-01, LIGHT-02, LIGHT-03
**Success Criteria** (what must be TRUE):
  1. Cancel button in Search shows a warm brown on-brand color
  2. FriendRecommendationsScreen background matches the warm brown palette
  3. Wall screen buttons render using correct theme token colors
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md — Fix Search cancel button token + FriendRecommendationsScreen transparent background
- [x] 01-02-PLAN.md — Fix Wall hardcoded gradient colors and incorrect button tokens

### Phase 2: Dark Mode
**Goal**: Every screen renders correctly when dark mode is active
**Depends on**: Phase 1
**Requirements**: DARK-01, DARK-02, DARK-03, DARK-04
**Success Criteria** (what must be TRUE):
  1. Dark mode palette in theme.ts uses warm brown values with no purple or cool greys
  2. All auth screens display correctly in dark mode
  3. All five main tab screens display correctly in dark mode
  4. Onboarding/profile screens display correctly in dark mode
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Fix dark palette values in theme.ts + add text.grey token
- [x] 02-02-PLAN.md — Auth screens sweep
- [x] 02-03-PLAN.md — Main tab screens sweep
- [x] 02-04-PLAN.md — Onboarding screens + shared components
- [x] 02-05-PLAN.md — Human visual verification checkpoint

### Phase 3: Consistency Sweep (DEFERRED to v1.2)
**Goal**: No screen or component uses hardcoded colors; theme switches reactively
**Depends on**: Phase 2
**Requirements**: CONS-01, CONS-02, CONS-03
**Success Criteria** (what must be TRUE):
  1. No hex color literals appear in any screen file
  2. Shared components use useTheme() for all colors
  3. Toggling light/dark takes effect immediately without app restart
**Plans**: TBD

</details>

---

### 🚧 v1.1 Website Completion (In Progress)

**Milestone Goal:** Complete the brand portal and backend to production-ready state — full order lifecycle, product enrichment, account management, 2FA, and notifications.

#### Phase 4: Order Status Foundation
**Goal**: Orders have a complete, auditable status lifecycle that brands and buyers can observe
**Depends on**: Phase 3 (v1.0 foundation)
**Requirements**: ORDR-01, ORDR-02, ORDR-03, ORDR-04, ORDR-05
**Success Criteria** (what must be TRUE):
  1. An order's status transitions (created → paid → shipped → returned) are stored in DB and visible in the brand portal orders view
  2. An unpaid order automatically expires after the configured timeout and cannot be paid after expiry
  3. A buyer can cancel their own unpaid order; an admin can cancel any order
  4. The brand portal orders view shows delivery cost per order
**Plans**: 3 plans

Plans:
- [ ] 04-01-PLAN.md — DB schema: new OrderStatus values, expires_at column, OrderStatusEvent history table + migration
- [ ] 04-02-PLAN.md — API logic: buyer cancel, admin cancel, auto-expiry (APScheduler), status audit trail
- [ ] 04-03-PLAN.md — API summary + frontend: shipping_cost in order list, new status labels/colors in brand portal

#### Phase 5: Brand Profile Restructure
**Goal**: Brand profile and delivery settings are clearly organized, legally protected, and validated
**Depends on**: Phase 4
**Requirements**: PROF-01, PROF-02, PROF-03, VALID-01, VALID-02
**Success Criteria** (what must be TRUE):
  1. Legal/payout fields (INN, address, payout account) are behind a modal and locked after first save, with a support contact prompt visible
  2. Delivery settings have a dedicated section with price, free-delivery threshold, and time-range dropdowns
  3. All web portal forms enforce length/format/required constraints with visible inline error messages
  4. API validation errors are structured and surfaced by the frontend as readable messages
**Plans**: TBD

#### Phase 6: Product Enrichment (API + Web)
**Goal**: Brands can enrich products with sale prices, sizing tables, and per-product delivery times via the web portal
**Depends on**: Phase 5
**Requirements**: PROD-01, PROD-03, PROD-04, PROD-06
**Success Criteria** (what must be TRUE):
  1. Brand can set a sale price (% off or exact) on any product and the API serves it; brand can remove the sale from the products list
  2. Brand can upload a sizing table image per product and the image is stored and served via API
  3. Brand can set a delivery time range per product that overrides the brand default, and the API serves the effective delivery time
**Plans**: 3 plans

Plans:
- [ ] 06-01-PLAN.md — API: sale_price/sale_type/sizing_table_image columns, migration, schemas, product_to_schema backfill
- [ ] 06-02-PLAN.md — Web: sale price set/remove UI in ProductDetailsModal and ProductsView
- [ ] 06-03-PLAN.md — Web: sizing table image upload + delivery time override selects in ProductDetailsModal

#### Phase 7: Account Management + 2FA
**Goal**: Brands have full control over their account lifecycle and can secure it with two-factor authentication
**Depends on**: Phase 6
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04, 2FA-01, 2FA-02, 2FA-03
**Success Criteria** (what must be TRUE):
  1. Brand can toggle "inactive" mode — their products disappear from buyer discovery while existing orders remain manageable
  2. Brand can delete their account; active/paid orders are preserved, products hidden, personal data handled per legal compliance
  3. Brand has a Security settings screen where they can change their password
  4. When 2FA is enabled, login requires an email OTP step with a resend button (rate-limited: max 3 resends, 60s cooldown) and codes expire after the configured window
**Plans**: 4 plans

Plans:
- [ ] 07-01-PLAN.md — DB: is_inactive/scheduled_deletion_at on Brand + 2FA columns on AuthAccount + migration
- [ ] 07-02-PLAN.md — API: inactive toggle, account deletion, change-password, 2FA enable/confirm/disable endpoints
- [ ] 07-03-PLAN.md — API: 2FA-aware brand login, OTP verify + resend with rate limiting + lockout
- [ ] 07-04-PLAN.md — Web: SecuritySettingsPage (inactive, change-pw, 2FA, delete) + Portal 2FA challenge

#### Phase 8: Notifications
**Goal**: Brands receive in-app notifications for order events; buyers receive push notifications on mobile; admin can send manual notifications
**Depends on**: Phase 7
**Requirements**: NOTIF-02, NOTIF-01, NOTIF-03, NOTIF-05, NOTIF-04, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. Notifications are stored in DB per recipient and served via API
  2. A notification bell in the brand portal shows recent notifications, including new order alerts
  3. A new order triggers an automatic notification to the relevant brand
  4. The mobile app is registered for Expo Push Notifications and receives pushes in production
  5. A buyer receives a push notification when their order status changes (e.g. shipped)
**Plans**: 4 plans

Plans:
- [ ] 08-01-PLAN.md — DB: Notification model + migration, notification_service.py, brand API endpoints, new-order trigger
- [ ] 08-02-PLAN.md — Web: DashboardHeader bell with unread badge, dropdown list, mark-read, order navigation
- [ ] 08-03-PLAN.md — Mobile: expo-notifications install, push token registration in App.tsx, API endpoint
- [ ] 08-04-PLAN.md — API: buyer push on SHIPPED + admin broadcast endpoint + AdminNotificationsPage in portal

#### Phase 9: Admin Dashboard + Mobile Enrichment Display
**Goal**: Admin can oversee all orders and send notifications; mobile buyers see sale prices, sizing tables, and delivery times on product cards
**Depends on**: Phase 8
**Requirements**: ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04, PROD-02, PROD-05, PROD-07
**Success Criteria** (what must be TRUE):
  1. ✅ Admin can access dedicated routes inside the brand portal (protected by admin flag)
  2. Admin can log a return for any order (returns log table + log-return flow)
  3. Admin can send manual notifications to brands (in-app) and buyers (push)
  4. Mobile product card shows a crossed-out original price when a sale is active
  5. Mobile product card backside shows sizing table image and delivery time

**What was built (2026-02-25 — plan 01):**
- Admin login page (`/admin`) with JWT auth stored in localStorage
- `AdminAuthContext` + `AdminProtectedRoute` guarding `/admin/dashboard`
- `AdminDashboard` shell with sidebar navigation
- `AdminNotificationsView` — broadcast message form (in-app to all active brands)
- `adminApi.ts` — `adminLogin()` + `sendAdminNotification()` API calls
- Backend: `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/notifications/send`, `POST /api/v1/admin/orders/{id}/cancel`
- `get_current_admin()` dependency (JWT + `is_admin: True` flag)

**Plans**: 4 plans

Plans:
- [x] 09-01-PLAN.md — Admin login, auth context, protected route, dashboard shell, broadcast UI, API endpoints
- [ ] 09-02-PLAN.md — Admin returns log table + log-return flow (backend API + frontend view)
- [ ] 09-03-PLAN.md — Admin buyer push broadcast tab in Notifications view
- [ ] 09-04-PLAN.md — Mobile: sale price display, sizing table image, delivery time on card + cart

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Light Mode Fixes | v1.0 | 2/2 | Complete | 2026-02-22 |
| 2. Dark Mode | v1.0 | 5/5 | Complete | 2026-02-23 |
| 3. Consistency Sweep | v1.0 | 0/TBD | Deferred to v1.2 | - |
| 4. Order Status Foundation | v1.1 | 3/3 | Complete | 2026-02-23 |
| 5. Brand Profile Restructure | v1.1 | 3/3 | Complete | 2026-02-24 |
| 6. Product Enrichment (API + Web) | v1.1 | 3/3 | Complete | 2026-02-24 |
| 7. Account Management + 2FA | v1.1 | 4/4 | Complete | 2026-02-24 |
| 8. Notifications | v1.1 | 4/4 | Complete | 2026-02-25 |
| 9. Admin Dashboard + Mobile Display | 1/3 | In Progress|  | - |
