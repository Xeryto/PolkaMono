# Roadmap: Polka Mobile Theme Consistency & Dark Mode

## Overview

Fix broken light mode spots, repair dark mode across all screens, then sweep for hardcoded colors to enforce theme consistency. The app goes from visually inconsistent to fully on-brand in both modes.

## Phases

- [x] **Phase 1: Light Mode Fixes** - Correct specific broken colors in light mode (completed 2026-02-22)
- [ ] **Phase 2: Dark Mode** - Make dark mode work correctly across all screens
- [ ] **Phase 3: Consistency Sweep** - Eliminate all hardcoded colors, enforce useTheme() everywhere

## Phase Details

### Phase 1: Light Mode Fixes
**Goal**: Known broken spots in light mode are corrected and on-brand
**Depends on**: Nothing (first phase)
**Requirements**: LIGHT-01, LIGHT-02, LIGHT-03
**Success Criteria** (what must be TRUE):
  1. Cancel button in Search (and any other screen) shows a warm brown on-brand color, not an incorrect color
  2. FriendRecommendationsScreen background matches the warm brown palette (`#F2ECE7` family)
  3. Wall screen buttons render using correct theme token colors
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Fix Search cancel button token + FriendRecommendationsScreen transparent background
- [ ] 01-02-PLAN.md — Fix Wall hardcoded gradient colors and incorrect button tokens

### Phase 2: Dark Mode
**Goal**: Every screen renders correctly when dark mode is active
**Depends on**: Phase 1
**Requirements**: DARK-04, DARK-01, DARK-02, DARK-03
**Success Criteria** (what must be TRUE):
  1. Dark mode palette in `theme.ts` uses warm brown values (`#261E1A`, `#52453C`, `#806B59`) with no purple or cool greys
  2. All auth screens (Welcome, Login, Signup, ForgotPassword, etc.) display correctly in dark mode — no hardcoded light colors visible
  3. All five main tab screens (Wall, Search, Cart, Favorites, Settings) display correctly in dark mode
  4. Onboarding/profile screens (BrandSearch, StylesSelection, FriendRecommendations) display correctly in dark mode
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Fix dark palette values in theme.ts + add text.grey token + 200ms fade transition in ThemeContext
- [ ] 02-02-PLAN.md — Auth screens sweep: fix all hardcoded colors in 12 auth/loading screens
- [ ] 02-03-PLAN.md — Main tab screens sweep: fix Wall, Search, Cart, Favorites, Settings, MainPage, App.tsx
- [ ] 02-04-PLAN.md — Onboarding screens + shared components: BrandSearch, StylesSelection, FriendRecommendations, AvatarEdit, RecentPieces, AvatarImage, NetworkLoadingIndicator, RoundedBox
- [ ] 02-05-PLAN.md — Human visual verification checkpoint for all dark mode screens

### Phase 3: Consistency Sweep
**Goal**: No screen or component uses hardcoded colors; theme switches reactively
**Depends on**: Phase 2
**Requirements**: CONS-01, CONS-02, CONS-03
**Success Criteria** (what must be TRUE):
  1. No hex color literals appear in any screen file — all colors come from `useTheme()` tokens
  2. Shared components (`AvatarImage`, `NetworkLoadingIndicator`, `RoundedBox`) use `useTheme()` for all colors
  3. Toggling light/dark in Settings takes effect immediately without requiring an app restart
**Plans**: TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Light Mode Fixes | 2/2 | Complete   | 2026-02-22 |
| 2. Dark Mode | 1/5 | In Progress | - |
| 3. Consistency Sweep | 0/TBD | Not started | - |
