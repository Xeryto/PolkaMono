# Requirements: Polka Mobile Theme

**Defined:** 2026-02-21
**Core Value:** Every screen in both light and dark mode looks intentional and on-brand, with no hardcoded colors.

## v1 Requirements

### Light Mode Fixes

- [x] **LIGHT-01**: Cancel button renders with correct on-brand color in Search and all other screens
- [x] **LIGHT-02**: FriendRecommendationsScreen background matches the warm brown palette
- [x] **LIGHT-03**: Wall screen buttons use correct theme token colors
- [ ] **LIGHT-04**: ~~Off-palette purple register colors removed~~ — confirmed not broken; deferred to Phase 3 sweep

### Dark Mode

- [x] **DARK-01**: All auth screens (Welcome, Login, Signup, ForgotPassword, etc.) render correctly in dark mode
- [ ] **DARK-02**: Main tab screens (Wall, Search, Cart, Favorites, Settings) render correctly in dark mode
- [ ] **DARK-03**: Onboarding/profile screens (BrandSearch, StylesSelection, FriendRecommendations) render correctly in dark mode
- [x] **DARK-04**: Dark mode palette values in `theme.ts` are correct (warm brown family: `#261E1A`, `#52453C`, `#806B59`)

### Theme Consistency

- [ ] **CONS-01**: All screens consume colors exclusively via `useTheme()` — no hardcoded hex values in screen files
- [ ] **CONS-02**: All reusable components (`AvatarImage`, `NetworkLoadingIndicator`, `RoundedBox`) use `useTheme()`
- [ ] **CONS-03**: Theme switches reactively (light ↔ dark) without requiring app restart

## v2 Requirements

### Polish

- **POL-01**: Smooth animated transition when switching themes
- **POL-02**: Per-screen visual QA screenshots

## Out of Scope

| Feature | Reason |
|---------|--------|
| Palette redesign | Brownish direction is correct — not a rebrand |
| New color schemes beyond light/dark/system | Out of current scope |
| Typography changes | Not requested |
| API / backend changes | Theme is client-side only |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LIGHT-01 | Phase 1 | Complete |
| LIGHT-02 | Phase 1 | Complete |
| LIGHT-03 | Phase 1 | Complete |
| LIGHT-04 | Phase 3 | Deferred (not broken) |
| DARK-04 | Phase 2 | Complete |
| DARK-01 | Phase 2 | Complete |
| DARK-02 | Phase 2 | Pending |
| DARK-03 | Phase 2 | Pending |
| CONS-01 | Phase 3 | Pending |
| CONS-02 | Phase 3 | Pending |
| CONS-03 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after initial definition*
