---
phase: quick-2
plan: 2
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/mobile/app/Settings.tsx
  - packages/mobile/app/MainPage.tsx
  - packages/mobile/app/Favorites.tsx
  - packages/mobile/app/screens/ConfirmationScreen.tsx
  - packages/mobile/app/screens/RecentPiecesScreen.tsx
  - packages/mobile/app/AuthLoadingScreen.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Every color visible in light mode matches the pre-theme hardcoded value from commit 2bb91e2"
    - "Settings.tsx uses theme tokens for all colors (no hardcoded hex in styles)"
    - "No light mode regression introduced - token values unchanged"
  artifacts:
    - path: "packages/mobile/app/Settings.tsx"
      provides: "Settings screen fully themed via createStyles(theme)"
      contains: "createStyles"
    - path: "packages/mobile/app/MainPage.tsx"
      provides: "Tab bar hardcoded colors replaced with theme tokens"
  key_links:
    - from: "packages/mobile/app/Settings.tsx"
      to: "packages/mobile/app/lib/theme.ts"
      via: "useTheme() + createStyles(theme)"
      pattern: "const \\{ theme \\} = useTheme"
---

<objective>
Verify every light mode color matches pre-theme commit 2bb91e2, then fix all mismatches by migrating remaining hardcoded colors to theme tokens.

Purpose: Light mode should be visually identical to pre-theme state. Any deviation is a regression.
Output: All screens using theme tokens in light mode with values identical to original hardcoded colors.
</objective>

<execution_context>
@/Users/goldp1/.claude/get-shit-done/workflows/execute-plan.md
@/Users/goldp1/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/goldp1/Polka/packages/mobile/app/lib/theme.ts
@/Users/goldp1/Polka/packages/mobile/app/Cart.tsx

Reference commit (pre-theme): 2bb91e2f082ef6b27e15543908c2b1a7ecad1502
Use `git show 2bb91e2:packages/mobile/<file>` to retrieve pre-theme versions.

Pattern to follow: `Cart.tsx` — imports `useTheme`, destructures `theme` in component, uses `useMemo(() => createStyles(theme), [theme])`, defines `createStyles = (theme: ThemeColors) => StyleSheet.create({...})` at bottom.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Migrate Settings.tsx to dynamic theme styles</name>
  <files>packages/mobile/app/Settings.tsx</files>
  <action>
Settings.tsx has a static `StyleSheet.create` at line 3447 with 124 hardcoded colors and zero theme token usage. It already imports `useTheme` but only uses it for the theme mode toggle UI. Migrate it fully to the `createStyles(theme)` pattern used by Cart.tsx.

Steps:
1. Get pre-theme colors: `git show 2bb91e2:packages/mobile/app/Settings.tsx`
2. In the Settings component (line 287), add `const { theme } = useTheme();` alongside the existing `const { themeMode, setThemeMode } = useTheme();` — combine into one destructure: `const { theme, themeMode, setThemeMode } = useTheme();`
3. Add `const styles = useMemo(() => createStyles(theme), [theme]);` in the component body (after theme destructure, before return). Add `useMemo` to the React import.
4. Add `import type { ThemeColors } from './lib/theme';` if not present.
5. Replace `const styles = StyleSheet.create({` at line 3447 with `const createStyles = (theme: ThemeColors) => StyleSheet.create({`
6. Map every hardcoded color to the correct light theme token. Reference mapping (pre-theme color → token):
   - `#F2ECE7` → `theme.background.primary`
   - `#E2CCB2` → `theme.surface.cartItem` (secondary surface / cart item bg)
   - `#DCBF9D` → `theme.surface.elevated`
   - `#DCC1A5` → `theme.surface.selection`
   - `#DEC2A1` → `theme.gender.circle`
   - `#C5A077` → `theme.gender.circleSelected`
   - `#D0C0B0` → `theme.status.errorBackground` NO — check pre-theme: `#D0C0B0` appears as Switch track false color → use inline or add token. Keep as `#D0C0B0` only for Switch `trackColor.false` and `ios_backgroundColor` (these are UI controls not design surfaces).
   - `#CDA67A` → `theme.primary`
   - `#E2B4B3` → `theme.button.delete`
   - `#E0D6CC` → `theme.background.input`
   - `#000` / `#000000` / `black` → `theme.text.primary`
   - `#FFF` / `#FFFFFF` / `white` → `theme.text.inverse`
   - `#666` → `theme.text.tertiary` (pre-theme used `#666` as secondary UI text; closest token: use `theme.text.tertiary` which is `#6A462F` — MISMATCH. `#666` is a neutral grey not in theme. Check pre-theme: Settings used `#666` for subtitle/muted text. The token `theme.text.tertiary` = `#6A462F` is brown, not grey. Keep `#666` as-is for muted/subtitle text since there is no matching neutral grey token.)
   - `#6A462F` → `theme.text.tertiary`
   - `#CCA479` (used in ConfirmationScreen, similar to primary) — not in Settings
   - `rgba(205, 166, 122, 0.4)` → `theme.border.default`
   - `rgba(205, 166, 122, 0.3)` → `theme.interactive.ripple`
   - `rgba(205, 166, 122, 0)` → `theme.border.transparent` (transparent version of primary border)
   - `rgba(0,0,0,0.5)` / `rgba(0, 0, 0, 0.5)` → `theme.modal.backdrop`
   - `rgba(0,0,0,0.6)` → keep as-is (no token; used for overlay text shadow)
   - `rgba(0,0,0,0.05)` → keep as-is (no token; very subtle shadow)
   - `rgba(0, 170, 0, 0.4)` → keep as-is (success highlight, no token)
   - `#00AA00` → `theme.status.success`
   - `#FF0000` → keep as-is (error indicator, `theme.status.error` is `#D32F2F` not `#FF0000`)
   - `#FF6464` → `theme.status.errorText`
   - `#FF6B6B` → keep as-is (slightly different red, no exact token)
   - `#A0A0A0` → keep as-is (inactive/disabled neutral grey, no exact token)
   - `rgba(255, 100, 100, 0.7)` → `theme.border.error`
   - `rgba(255, 165, 0, 0.7)` → `theme.border.checking`
   - `#808080` (in inline conditional colors for icons at line 1853/1878) → keep as-is (neutral icon grey)
   - `#B59679` and `#32261B` (Switch tintColor/backgroundColor at line 1818-1819) → `tintColor` → `theme.accent`, `backgroundColor` → `theme.text.secondary`
   - `transparent` → `'transparent'` or `theme.border.transparent`

   For any inline hardcoded colors in JSX (not in styles object), apply the same mapping.

7. Verify no remaining hardcoded hex colors exist in the styles section (except the Switch track colors `#D0C0B0` and the neutral greys `#666`, `#808080`, `#A0A0A0` which have no theme token equivalent).
  </action>
  <verify>
    Run: `grep -c "theme\." packages/mobile/app/Settings.tsx`
    Should return a significantly higher number (50+).
    Run: `grep -n "#[0-9a-fA-F]\{6\}" packages/mobile/app/Settings.tsx | grep -v "^\s*//" | wc -l`
    Should be ≤15 (only intentional neutrals with no token equivalent remain).
    TypeScript check: `yarn workspace polkamobile tsc --noEmit 2>&1 | grep Settings` — should return no errors.
  </verify>
  <done>Settings.tsx styles use theme tokens for all design colors. Remaining hardcoded values are only neutral greys (#666, #808080, #A0A0A0, #D0C0B0) that have no theme token equivalent and match the pre-theme values exactly.</done>
</task>

<task type="auto">
  <name>Task 2: Fix remaining hardcoded colors in MainPage, Favorites, and other screens</name>
  <files>
    packages/mobile/app/MainPage.tsx
    packages/mobile/app/Favorites.tsx
    packages/mobile/app/screens/ConfirmationScreen.tsx
    packages/mobile/app/screens/RecentPiecesScreen.tsx
    packages/mobile/app/AuthLoadingScreen.tsx
  </files>
  <action>
Fix the remaining hardcoded colors in these files. For each, use `git show 2bb91e2:packages/mobile/<file>` to confirm the pre-theme value, then replace with the appropriate token.

**MainPage.tsx** (13 hardcoded hex values, all in inline styles):
- Lines 1853, 1878: `"#808080"` — icon color for inactive tab, no theme token. Keep as-is (matches pre-theme).
- Lines 2989, 3061, 3065, 3070: `"#333"`, `"#555"`, `"#777"` — used for tab bar label text. Pre-theme used these exact values. Check theme: no exact tokens. Keep as-is OR note these need new tokens added. Decision: keep as-is since these are the pre-theme values and changing them would introduce a regression.
- Lines 3030, 3040: `backgroundColor: "#F2ECE7"` → replace with `theme.background.primary` (MainPage already uses `theme` from `createStyles`; these may be inline styles — check context and replace).
- Line 3048: `borderBottomColor: "#eee"` → `theme.border.light`
- Line 3089: `color: "#FFF"` → `theme.text.inverse`

Before making changes, read the surrounding code for each line to understand if it's in a StyleSheet or inline.

**Favorites.tsx** (9 hardcoded hex values):
- Lines 1463, 1546: `"#C8A688"` and `"#AE8F72"` for activeView toggle button backgrounds. Pre-theme: `#C8A688` = `theme.accent`, `#AE8F72` has no token (darker variant). Keep `#C8A688` → `theme.accent`, keep `#AE8F72` as-is.
- Line 1535, 1798: `fill="#FFF"` on SVG — keep as-is (SVG fill, not a StyleSheet color).
- Lines 2062, 2084: `colors={["#FC8CAF", "#9EA7FF", "#A3FFD0"]}` and `colors={["#E222F0", "#4747E4", "#E66D7B"]}` — these are the regenerate button gradient colors. Replace with `theme.gradients.regenerateButtonBorder` and `theme.gradients.regenerateButton`.
- Line 1723: `color="#CDA67A"` on ActivityIndicator → `theme.primary`

**ConfirmationScreen.tsx** (2 hardcoded hex values):
- Lines 115, 153: `color: "#CCA479"` — pre-theme had `#CCA479` (slightly different from `#CDA67A` primary). Check theme: `theme.gradients.main[1]` = `'#CCA479'`. This is a link/accent text color. No standalone token. Keep as-is since it matches pre-theme exactly and adding a new token is out of scope.

**RecentPiecesScreen.tsx** (3 hardcoded hex values):
- Line 359: `color="#CDA67A"` on ActivityIndicator → `theme.primary`
- Lines 488, 564: `shadowColor: "#000"` → `theme.shadow.default`

**AuthLoadingScreen.tsx** (1 hardcoded):
- Line 106: `backgroundColor: 'rgba(243, 230, 214, 1)'` — pre-theme had this exact value. In light mode, `theme.background.loading` = `'#F3E6D6'` which is the same color without the rgba wrapper. Replace with `theme.background.loading` for consistency. Confirm the component already has `const { theme } = useTheme()` or add it.
  </action>
  <verify>
    Run: `grep -n "#[0-9a-fA-F]\{3,8\}" packages/mobile/app/MainPage.tsx packages/mobile/app/Favorites.tsx packages/mobile/app/screens/ConfirmationScreen.tsx packages/mobile/app/screens/RecentPiecesScreen.tsx packages/mobile/app/AuthLoadingScreen.tsx | grep -v "^\s*//" | grep -v "#808080\|#AE8F72\|#CCA479\|#333\|#555\|#777"`
    Should return empty or only the intentional exclusions listed above.
    TypeScript check: `yarn workspace polkamobile tsc --noEmit 2>&1 | grep -E "MainPage|Favorites|ConfirmationScreen|RecentPieces|AuthLoading"` — no errors.
  </verify>
  <done>All fixable hardcoded colors replaced with theme tokens. Remaining hardcoded values are only: neutral greys (#333, #555, #777, #808080) with no theme equivalent, #AE8F72 (darker accent variant, no token), #CCA479 (gradient accent color only in gradients array, not a standalone token). These all match pre-theme values exactly.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `grep -rn "#[0-9a-fA-F]\{6\}" packages/mobile/app/Settings.tsx packages/mobile/app/MainPage.tsx packages/mobile/app/Favorites.tsx | grep -v "^\s*//" | wc -l` — should be dramatically reduced vs baseline of 124+13+9=146.
2. `yarn workspace polkamobile tsc --noEmit` — no new TypeScript errors.
3. Light mode token values in `theme.ts` are UNCHANGED (verify with `git diff packages/mobile/app/lib/theme.ts` — should show no diff).
4. All colors now visible in light mode map to `lightColors` values that match the pre-theme hardcoded values from commit 2bb91e2.
</verification>

<success_criteria>
- Settings.tsx uses createStyles(theme) pattern with theme tokens for all design colors
- MainPage, Favorites, ConfirmationScreen, RecentPiecesScreen, AuthLoadingScreen have no fixable hardcoded colors remaining
- `theme.ts` lightColors object is unchanged (no regression to token values)
- TypeScript compiles without new errors
- Every color visible in light mode is identical to pre-theme commit 2bb91e2
</success_criteria>

<output>
After completion, create `.planning/quick/2-verify-every-single-color-in-light-mode-/2-SUMMARY.md` following the summary template.
</output>
