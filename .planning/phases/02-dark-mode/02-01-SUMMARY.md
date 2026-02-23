---
phase: 02-dark-mode
plan: 01
subsystem: mobile-theme
tags: [dark-mode, theme, animation, palette]
dependency-graph:
  requires: []
  provides: [correct-dark-palette, text-grey-token, theme-fade-animation]
  affects: [all-dark-mode-screens, ThemeContext, App]
tech-stack:
  added: []
  patterns: [Animated fade crossfade, applyColorSchemeImmediate for no-flash init]
key-files:
  created: []
  modified:
    - packages/mobile/app/lib/theme.ts
    - packages/mobile/app/lib/ThemeContext.tsx
    - packages/mobile/App.tsx
decisions:
  - "Dark background = #261E1A (not #806B59 which is accent)"
  - "Dark text.primary = #F5EDE4 (warm off-white per user spec)"
  - "Dark accent/primary = #806B59 (primary accent color)"
  - "text.grey: '#808080' light, '#9A8878' dark (warmer for legibility)"
  - "Initial theme load uses applyColorSchemeImmediate to avoid startup flash"
  - "System theme changes use animated applyColorScheme same as user toggles"
metrics:
  duration: ~2 min
  completed: 2026-02-23
  tasks-completed: 2
  files-modified: 3
---

# Phase 02 Plan 01: Dark Palette Correction + Fade Transition Summary

Corrected dark mode color palette in theme.ts to match user-specified values, added text.grey token to ThemeColors interface and both color objects, and implemented a 200ms opacity crossfade in ThemeContext when mode changes.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Fix dark palette + add text.grey token | cc48535 | theme.ts |
| 2 | Add 200ms fade transition to ThemeContext | f96d0de | ThemeContext.tsx, App.tsx |

## What Was Built

**Task 1 - theme.ts corrections:**
- `darkColors.background.primary` = `#261E1A` (was `#806B59` — that was accent)
- `darkColors.background.secondary/tertiary/elevated/input/loading` = `#3D3028` or `#261E1A`
- `darkColors.surface.*` = `#3D3028` range (was `#52453C` or `#EDE7E2`)
- `darkColors.text.primary` = `#F5EDE4` (warm off-white, was `#FFFFFF`)
- `darkColors.text.secondary` = `#C4A882`, `tertiary` = `#A07856` (legible on dark)
- `darkColors.text.inverse` = `#261E1A` (was `#000000`)
- `darkColors.button.primary` = `#806B59` (accent as dark button bg)
- `darkColors.button.primaryText/secondaryText/checkoutText` = `#F5EDE4`
- `darkColors.modal.background` = `#261E1A` (was `#806B59`)
- `darkColors.gradients.main` = `['#3D3028', '#261E1A', '#1F1713', '#130E0B']`
- `darkColors.border.default` = `rgba(128, 107, 89, 0.4)` (accent-based)
- `darkColors.size.userSize` = `#806B59`, `selected` = `#806B59` (accent highlight)
- `darkColors.accent` = `#806B59`, `darkColors.primary` = `#806B59`
- Added `text.grey` to `ThemeColors` interface + `lightColors.text.grey = '#808080'` + `darkColors.text.grey = '#9A8878'`

**Task 2 - ThemeContext.tsx + App.tsx:**
- Added `useRef` import, `fadeAnim = useRef(new Animated.Value(1)).current`
- `applyColorSchemeImmediate()` applies scheme instantly (used for initial load — no startup flash)
- `applyColorScheme()` fades opacity 1→0 over 100ms, applies scheme, fades 0→1 over 100ms (~200ms total)
- `fadeAnim: Animated.Value` added to `ThemeContextType` interface and Provider value
- App.tsx: `AppContent` calls `useTheme()` for `fadeAnim`; wraps `GestureHandlerRootView` in `<Animated.View style={{ flex: 1, opacity: fadeAnim }}>`

## Deviations from Plan

**1. [Rule 2 - Missing functionality] applyColorSchemeImmediate split**
- Found during: Task 2
- Issue: Plan specified "initial load does not animate" but original code used single `applyColorScheme`. System theme listener changes were animated (good) but needed clear separation from initial load path.
- Fix: Split into `applyColorSchemeImmediate` (for `loadThemePreference`) and `applyColorScheme` (animated, for user toggles + system changes). This is cleaner and matches plan intent.
- Files modified: ThemeContext.tsx

**2. [Rule 1 - Cleanup] Remove unused ColorSchemeName import**
- Found during: Task 2
- Issue: Original ThemeContext imported `ColorSchemeName` from react-native but never used it.
- Fix: Removed from import.
- Files modified: ThemeContext.tsx

## Self-Check: PASSED

- theme.ts: FOUND
- ThemeContext.tsx: FOUND
- App.tsx: FOUND
- Commit cc48535: FOUND
- Commit f96d0de: FOUND
