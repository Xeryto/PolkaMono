# Requirements: Polka v1.1 Website Completion

**Defined:** 2026-02-23
**Core Value:** Brands can run their storefront end-to-end; buyers get a smooth, trustworthy purchase experience.

## v1.1 Requirements

### Order Lifecycle

- [x] **ORDR-01**: Order has a DB-backed status (created/cancelled/paid/shipped/returned/partially-returned); status history is auditable
- [x] **ORDR-02**: Unpaid "created" orders expire automatically (configurable timeout, e.g. 24h)
- [x] **ORDR-03**: Buyer can cancel a "created" (unpaid) order
- [x] **ORDR-04**: Admin can cancel any order
- [x] **ORDR-05**: Orders view shows delivery cost per order

### Product Enrichment

- [x] **PROD-01**: Brand can set a sale price per product (% off or exact price); sale is stored and served via API
- [ ] **PROD-02**: Mobile app shows crossed-out original price when a sale is active
- [x] **PROD-03**: Brand can remove an active sale from the products page
- [x] **PROD-04**: Brand can upload a sizing table image per product
- [ ] **PROD-05**: Mobile app shows sizing table image on the back of the product card (Main page flip)
- [x] **PROD-06**: Brand can set a delivery time range per product (overrides brand default)
- [ ] **PROD-07**: Delivery time is shown on the back of the product card (Main page) and in the cart

### Brand Profile

- [x] **PROF-01**: Legal/payout fields (ИНН, address, payout account) are read-only behind a view-only modal; never editable by brands; admins change them directly
- [x] **PROF-02**: Delivery settings have a dedicated section: delivery price, min for free delivery (optional), delivery time range (dropdown: day/week ranges)
- [x] **PROF-03**: Per-product delivery time can override the brand default

### Brand Account

- [x] **ACCT-01**: Brand can set their account to "inactive" mode — products hidden from buyers, no new purchases, existing orders still manageable
- [x] **ACCT-02**: Brand can delete their account; active/paid orders preserved for history; products hidden; personal data handled per legal compliance
  - ⚠ **Gap**: personal data purge (anonymization of PII after grace period) not yet implemented — no background job exists; login blocks after deadline but DB row remains intact
- [x] **ACCT-03**: Brand has a "Security" settings screen with 2FA toggle and change-password form
- [x] **ACCT-04**: Brand can change their password from the Security screen

### Two-Factor Auth

- [x] **2FA-01**: If 2FA is enabled, login shows an email OTP step after credentials
- [x] **2FA-02**: OTP screen has a resend button with rate limiting (max 3 resends, 60s cooldown)
- [x] **2FA-03**: 2FA codes expire after a configurable window (e.g. 10 min)

### Input Validation

- [x] **VALID-01**: All web portal forms enforce reasonable constraints (max lengths, formats, required fields) with visible error messages
- [x] **VALID-02**: API endpoints return structured validation errors that the frontend surfaces

### Notifications

- [x] **NOTIF-01**: Notification bell in brand portal shows recent notifications (new orders, manual admin notifications)
- [x] **NOTIF-02**: Notifications are stored in DB per recipient
- [x] **NOTIF-03**: New order triggers a notification to the brand
- [ ] **NOTIF-04**: Admin can send manual push notifications to buyers, brands, or both
- [x] **NOTIF-05**: Mobile app receives push notifications (Expo Push Notifications, production-grade)
- [ ] **NOTIF-06**: Buyer receives push notification when their order status changes (shipped, etc.)

### Admin Dashboard

- [ ] **ADMIN-01**: Admin has dedicated routes inside the brand portal (protected by admin flag)
- [ ] **ADMIN-02**: Admin can view all orders across all brands
- [ ] **ADMIN-03**: Admin can log a return for any order (marks returned/partially returned; stock not auto-restored)
- [ ] **ADMIN-04**: Admin can send manual notifications (push + in-app) to buyers, brands, or both

## v2 Requirements

### Polish

- **POL-01**: Smooth animated transition when switching themes (mobile)
- **POL-02**: Per-screen visual QA screenshots

### Theme

- **CONS-01**: All screens consume colors exclusively via `useTheme()` — no hardcoded hex values
- **CONS-02**: All reusable components use `useTheme()`
- **CONS-03**: Theme switches reactively without app restart

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-admin accounts | Single global admin for now |
| Buyer-facing web app | Mobile only for buyers |
| Palette redesign | Brownish direction confirmed correct |
| Theme consistency sweep | Deferred to v1.2 |
| Stock auto-restore on admin return | Brand handles manually |
| OAuth login | Email/password + 2FA sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ORDR-01 | Phase 4 | Complete |
| ORDR-02 | Phase 4 | Complete |
| ORDR-03 | Phase 4 | Complete |
| ORDR-04 | Phase 4 | Complete |
| ORDR-05 | Phase 4 | Complete |
| PROF-01 | Phase 5 | Complete |
| PROF-02 | Phase 5 | Complete |
| PROF-03 | Phase 5 | Complete |
| VALID-01 | Phase 5 | Complete |
| VALID-02 | Phase 5 | Complete |
| PROD-01 | Phase 6 | Complete |
| PROD-03 | Phase 6 | Complete |
| PROD-04 | Phase 6 | Complete |
| PROD-06 | Phase 6 | Complete |
| ACCT-01 | Phase 7 | Complete |
| ACCT-02 | Phase 7 | Complete |
| ACCT-03 | Phase 7 | Complete |
| ACCT-04 | Phase 7 | Complete |
| 2FA-01 | Phase 7 | Complete |
| 2FA-02 | Phase 7 | Complete |
| 2FA-03 | Phase 7 | Complete |
| NOTIF-02 | Phase 8 | Complete |
| NOTIF-01 | Phase 8 | Complete |
| NOTIF-03 | Phase 8 | Complete |
| NOTIF-05 | Phase 8 | Complete |
| NOTIF-04 | Phase 8 | Pending |
| NOTIF-06 | Phase 8 | Pending |
| ADMIN-01 | Phase 9 | Pending |
| ADMIN-02 | Phase 9 | Pending |
| ADMIN-03 | Phase 9 | Pending |
| ADMIN-04 | Phase 9 | Pending |
| PROD-02 | Phase 9 | Pending |
| PROD-05 | Phase 9 | Pending |
| PROD-07 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-23*
*Last updated: 2026-02-23 — traceability populated after roadmap creation*
