---
phase: quick-1
plan: 1
subsystem: mobile/theme
tags: [theme, refactor, cleanup]
dependency_graph:
  requires: []
  provides: [consolidated-theme-gradients]
  affects: [packages/mobile/app/lib/theme.ts, 12-screens]
tech_stack:
  added: []
  patterns: [single-gradients-namespace, lean-ThemeColors-interface]
key_files:
  modified:
    - packages/mobile/app/lib/theme.ts
    - packages/mobile/app/screens/ForgotPasswordScreen.tsx
    - packages/mobile/app/screens/BrandSearchScreen.tsx
    - packages/mobile/app/screens/WelcomeScreen.tsx
    - packages/mobile/app/screens/SignupScreen.tsx
    - packages/mobile/app/screens/ConfirmationScreen.tsx
    - packages/mobile/app/screens/PasswordResetVerificationScreen.tsx
    - packages/mobile/app/screens/CheckYourEmailScreen.tsx
    - packages/mobile/app/screens/VerificationCodeScreen.tsx
    - packages/mobile/app/screens/RecentPiecesScreen.tsx
    - packages/mobile/app/screens/StylesSelectionScreen.tsx
    - packages/mobile/app/screens/LoginScreen.tsx
    - packages/mobile/app/screens/ResetPasswordScreen.tsx
decisions:
  - "gradient.welcome == gradients.main (identical values in both modes) — screens migrated to gradients.main"
  - "gradient.registerBorder == gradients.registerButton (identical values) — used gradients.registerButton, no new token added"
metrics:
  duration: ~5 min
  completed: 2026-02-22
---

# Phase quick-1 Plan 1: Consolidate Theme System Summary

Single-sentence summary: Merged duplicate `gradient` namespace into `gradients`, removed 30+ zero-usage tokens from ThemeColors interface, and updated 13 screens to use consolidated token paths.

## What Was Done

### Task 1: theme.ts cleanup (commit 2b5a607)

Removed from ThemeColors interface, lightColors, and darkColors:

**Gradient namespace removed:**
- `gradient` section (welcome + registerBorder) — replaced by existing gradients.* equivalents

**Background:**
- `background.gradient` sub-object (start/mid1/mid2/end)

**Surface:**
- `surface.default`, `surface.container`, `surface.buttonAlt`

**Text:**
- `text.placeholder`, `text.link`, `text.inverseAlt`

**Button:**
- `button.secondaryText`, `button.toggle`, `button.toggleText`, `button.deleteText`, `button.cancelIcon`

**Interactive:**
- `interactive.active`, `interactive.selected`, `interactive.unselected`, `interactive.hover`, `interactive.pressed`

**Status:**
- `status.successBorder`, `status.successText`, `status.warningBorder`, `status.warningText`, `status.warningBackground`, `status.checkingBorder`, `status.info`

**Social:**
- `social.pendingBadge`, `social.friendUsername`, `social.gradientAccent1`, `social.gradientAccent2`, `social.gradientAccent3`

**Whole sections removed:**
- `progress` (bar/fill/text)
- `switch` (trackOff/trackOn/thumb)
- `modal.border`

**Top-level primitives removed:**
- `primaryVariant`, `primaryDark`, `primaryDarker`

### Task 2: Screen migration (commit 2d03620)

13 screens updated:
- 12 screens: `theme.gradient.welcome` → `theme.gradients.main`
- WelcomeScreen: `theme.gradient.registerBorder` → `theme.gradients.registerButton`

## Gradient Consolidation Decision

`gradient.welcome` values were identical to `gradients.main` in both light and dark modes:
- Light: `['#FAE9CF', '#CCA479', '#CDA67A', '#6A462F']`
- Dark: `['#52453C', '#382E28', '#261E1A', '#1A1512']`

Decision: point all screens to `gradients.main` — no new token needed.

`gradient.registerBorder` values were identical to `gradients.registerButton`:
- Both: `['#DCD3DE', '#9535EA', '#E222F0']`

Decision: use `gradients.registerButton` — no new token added.

## Tokens Kept Despite Low Usage

- `gradients.mainLocations`, `gradients.regenerateButtonBorder`, `gradients.regenerateButton` — kept (not in plan's explicit removal list; out of scope for this task)

## Files Modified

13 files (1 theme file + 12 screen files)

## Deviations from Plan

None — plan executed exactly as written.

The only pre-existing TypeScript errors (expo-modules-core dependency, RoundedBox shadow type) were out of scope and not touched.

## Self-Check: PASSED

- `theme.gradient.welcome` usages: 0
- `theme.gradient.registerBorder` usages: 0
- `gradient:` section in theme.ts: 0 matches
- `gradients:` section in theme.ts: 3 matches (interface + lightColors + darkColors)
- Commits 2b5a607 and 2d03620: verified in git log
