---
phase: 07-account-management-2fa
plan: "04"
subsystem: frontend
tags: [security, 2fa, account-management, react, typescript]
dependency_graph:
  requires: [07-02, 07-03]
  provides: [SecuritySettingsPage, Portal-2FA-challenge]
  affects: [Dashboard, DashboardSidebar, api.ts]
tech_stack:
  added: []
  patterns: [Zod inline validation, AlertDialog confirmation, OTP countdown timer, 2FA state machine]
key_files:
  created:
    - packages/frontend/src/pages/SecuritySettingsPage.tsx
  modified:
    - packages/frontend/src/services/api.ts
    - packages/frontend/src/pages/Portal.tsx
    - packages/frontend/src/pages/Dashboard.tsx
    - packages/frontend/src/components/DashboardSidebar.tsx
decisions:
  - "Portal calls api.brandLogin directly (not AuthContext.login) to intercept otp_required before auth state is set"
  - "handleLoginSuccess uses window.location.href for hard redirect after 2FA verify — ensures AuthContext re-reads localStorage"
  - "BrandResponse interface extended with is_inactive + two_factor_enabled fields (already returned by API per schemas.py)"
  - "resendCount initialized to 1 on first OTP send; incremented on each resend; disabled when >= 3"
metrics:
  duration_minutes: 4
  completed_date: "2026-02-24"
  tasks_completed: 3
  files_modified: 5
---

# Phase 7 Plan 4: Security Settings Page + Portal 2FA Summary

Security settings page with inactive toggle, change password, 2FA enable/disable, account deletion; Portal updated for 2FA OTP challenge; Dashboard/Sidebar routing wired.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add Phase 7 API functions to api.ts | f1ef231 | packages/frontend/src/services/api.ts |
| 2 | Build SecuritySettingsPage.tsx | 046b2e1 | packages/frontend/src/pages/SecuritySettingsPage.tsx |
| 3 | Wire Dashboard/Sidebar routing + Portal 2FA | 54bd1eb | Dashboard.tsx, DashboardSidebar.tsx, Portal.tsx |

## What Was Built

**SecuritySettingsPage.tsx** — 4-section security settings page:
- Account Status: active/inactive toggle with AlertDialog confirmation; calls `toggleBrandInactive`
- Change Password: Zod-validated 3-field form (current/new/confirm); maps API 400 to inline error on current_password field
- 2FA: idle/pending_otp/disabling state machine; enable sends OTP email, shows code input + resend with 60s countdown + 3-resend limit; disable requires password
- Delete Account: two-step AlertDialog with consequence bullets + brand name confirmation input; calls `requestBrandDeletion` then logs out

**api.ts additions**:
- 8 new exported functions: `toggleBrandInactive`, `requestBrandDeletion`, `changeBrandPassword`, `enableBrand2FA`, `confirmBrand2FA`, `disableBrand2FA`, `verify2FA`, `resend2FA`
- 3 new interfaces: `BrandDeleteResponse`, `OTPLoginResponse`, `OTPVerifyResponse`
- `BrandResponse` extended with `is_inactive: boolean` + `two_factor_enabled: boolean`

**Portal.tsx** — 2FA OTP challenge flow:
- Login detects `otp_required: true` in response → switches to OTP input screen
- Shows 6-digit code input + resend button with 60s countdown + 3-resend limit
- On success calls `verify2FA` → stores token in localStorage + hard-redirects to /dashboard

**Dashboard.tsx + DashboardSidebar.tsx**:
- `'security'` added to `DashboardView` union type in both files
- Dashboard `renderView()` case added for SecuritySettingsPage
- Sidebar menu item "Безопасность" with `ShieldCheck` lucide icon

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing fields] BrandResponse missing is_inactive + two_factor_enabled**
- Found during: Task 1
- Issue: BrandResponse interface lacked fields already returned by API (schemas.py lines 594, 596)
- Fix: Added both fields to BrandResponse interface
- Files modified: packages/frontend/src/services/api.ts
- Commit: f1ef231

**2. [Rule 1 - Bug] Portal handleLoginSuccess needs hard redirect**
- Found during: Task 3
- Issue: AuthContext.login() is a separate call from api.brandLogin(); after 2FA verify we have a raw token+user (not going through AuthContext.login), so we need to manually set localStorage and force a page reload so AuthContext initializes from storage
- Fix: handleLoginSuccess sets localStorage directly then uses window.location.href for hard redirect
- Files modified: packages/frontend/src/pages/Portal.tsx
- Commit: 54bd1eb

## Self-Check: PASSED

- [x] SecuritySettingsPage.tsx exists at packages/frontend/src/pages/SecuritySettingsPage.tsx
- [x] api.ts has all 8 Phase 7 functions (verified grep)
- [x] Portal.tsx contains otp_required + showOtpStep + verify2FA
- [x] Dashboard.tsx has 'security' view + SecuritySettingsPage import
- [x] DashboardSidebar.tsx has Безопасность + ShieldCheck
- [x] TypeScript build passes (vite build, 0 errors)
- [x] Commits: f1ef231, 046b2e1, 54bd1eb
