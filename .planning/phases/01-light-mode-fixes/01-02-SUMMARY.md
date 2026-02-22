---
phase: 01-light-mode-fixes
plan: 02
subsystem: ui
tags: [react-native, theme, linear-gradient, expo]

# Dependency graph
requires: []
provides:
  - Wall screen LinearGradient using theme.gradients.overlay token
  - Wall screen placeholder text using theme.text.placeholderDark token
affects: [dark-mode, consistency-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns: [theme.gradients.overlay with overlayLocations for LinearGradient, theme.text.placeholderDark for opaque placeholder text]

key-files:
  created: []
  modified:
    - packages/mobile/app/Wall.tsx

key-decisions:
  - "LinearGradient locations prop added alongside colors to preserve overlayLocations: [0.2, 1] from theme token"
  - "placeholderTextColor replaced with theme.text.placeholderDark (rgba(0,0,0,1) in light, rgba(255,255,255,1) in dark)"

patterns-established:
  - "LinearGradient: use colors={theme.gradients.X as any} + locations={theme.gradients.XLocations as any}"

requirements-completed: [LIGHT-03]

# Metrics
duration: 3min
completed: 2026-02-22
---

# Phase 01 Plan 02: Wall Gradient Token Fix Summary

**Wall screen LinearGradient replaced hardcoded rgba(205,166,122,...) with theme.gradients.overlay token; brand search placeholder uses theme.text.placeholderDark**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-22T00:00:00Z
- **Completed:** 2026-02-22T00:03:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Wall LinearGradient now uses `theme.gradients.overlay` + `theme.gradients.overlayLocations` — adapts correctly between light and dark modes
- Brand search `placeholderTextColor` now uses `theme.text.placeholderDark` token instead of hardcoded `rgba(0,0,0,1)`
- Zero hardcoded off-brand rgba literals remain in Wall.tsx

## Task Commits

1. **Task 1: Replace hardcoded gradient colors and fix incorrect button tokens in Wall** - `ee392d3` (feat)

## Files Created/Modified
- `packages/mobile/app/Wall.tsx` - LinearGradient colors/locations and placeholderTextColor now use theme tokens

## Decisions Made
- Added `locations` prop alongside `colors` for LinearGradient so overlayLocations [0.2, 1] are respected (without locations the gradient stop positions default to even distribution)
- `rgba(0,0,0,0.5)` on Skia Canvas Shadow (line 902) and `#888888` in CardItem fallback data (lines 769/803) left unchanged — structural/data values, not UI color tokens

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Token] Brand search placeholderTextColor was hardcoded**
- **Found during:** Task 1 (scan for other hardcoded colors)
- **Issue:** `placeholderTextColor="rgba(0,0,0,1)"` in brand search TextInput — exact match to `theme.text.placeholderDark` token but hardcoded
- **Fix:** Replaced with `placeholderTextColor={theme.text.placeholderDark}`
- **Files modified:** packages/mobile/app/Wall.tsx
- **Verification:** No rgba(0,0,0,1) literals remain in JSX props
- **Committed in:** ee392d3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (missing token)
**Impact on plan:** Extra fix necessary for correctness in dark mode. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wall screen fully on-brand for light mode gradient and placeholder colors
- No blockers

---
*Phase: 01-light-mode-fixes*
*Completed: 2026-02-22*
