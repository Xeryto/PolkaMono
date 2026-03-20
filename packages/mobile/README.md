# Polka Mobile

Expo React Native app for the Polka fashion marketplace — the primary client for buyers.

Part of the [Polka monorepo](../../README.md).

## Tech stack

- React Native 0.81.5 (New Architecture enabled)
- Expo SDK 54
- React 19.1
- TypeScript 5.9
- React Native Reanimated 4.1
- React Native Gesture Handler 2.28
- Shopify React Native Skia 2.2
- React Navigation 6 (native stack + bottom tabs)

## Setup

From the monorepo root:

```bash
yarn install:all
cp packages/mobile/.env.example packages/mobile/.env
# Edit .env — set EXPO_PUBLIC_API_URL to your running API
yarn start:mobile         # Expo dev server (clears cache)
```

Then press `i` for iOS simulator or `a` for Android emulator.

For device testing, set `EXPO_PUBLIC_API_URL` to an ngrok URL or your machine's LAN IP.

## Environment variables

From `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `http://localhost:8000` | API server URL |
| `EXPO_PUBLIC_ENVIRONMENT` | `development` | Environment name |
| `EXPO_PUBLIC_API_TIMEOUT` | `10000` | API request timeout (ms) |
| `EXPO_PUBLIC_AUTH_TIMEOUT` | `20000` | Auth request timeout (ms) |
| `EXPO_PUBLIC_DEBUG_MODE` | `true` | Enable debug logging |
| `EXPO_PUBLIC_LOG_LEVEL` | `debug` | Log level |
| `EXPO_PUBLIC_API_DELAY` | `500` | Simulated API delay for dev (ms) |

## App structure

```
packages/mobile/
├── App.tsx                    Root component, navigation container, phase manager
├── app.json                   Expo config (bundle ID, plugins, EAS)
├── eas.json                   EAS Build profiles
├── app/
│   ├── screens/               Auth flow screens
│   │   ├── WelcomeScreen      Landing with login/signup overlays
│   │   ├── LoginScreen        Email + password login
│   │   ├── SignupScreen        Registration
│   │   ├── VerificationCodeScreen  Email verification
│   │   ├── ForgotPasswordScreen
│   │   ├── PasswordResetVerificationScreen
│   │   ├── ResetPasswordScreen
│   │   ├── ConfirmationScreen  Gender selection
│   │   ├── AvatarEditScreen
│   │   ├── BrandSearchScreen   Favorite brands picker
│   │   ├── StylesSelectionScreen
│   │   ├── RecentPiecesScreen
│   │   ├── FriendRecommendationsScreen
│   │   └── FriendLikedItemsScreen
│   ├── components/
│   │   ├── swipeCard/         SwipeCard, CardFront, CardBack, HeartButton
│   │   ├── svg/               30+ SVG icon components
│   │   ├── PriceTag, SkeletonCard, ErrorBanner, AvatarImage, ...
│   ├── services/
│   │   ├── api.ts             API client + SessionManager singleton
│   │   ├── networkUtils.ts    Timeout + retry logic
│   │   ├── apiHelpers.ts      Response parsing
│   │   └── apiHealthCheck.ts
│   ├── hooks/
│   │   ├── useSwipeDeck.ts    Swipe/flip/size/color/like state
│   │   ├── useSession.ts      JWT + auth state
│   │   └── useNetworkRequest.ts
│   ├── lib/
│   │   ├── theme.ts           Light/dark color tokens
│   │   ├── ThemeContext.tsx    useTheme() hook
│   │   ├── ReduceMotionContext.tsx  useMotion() hook
│   │   ├── swipeCardConstants.ts
│   │   ├── swipeCardUtils.ts
│   │   ├── productMapper.ts
│   │   ├── translations.ts
│   │   └── animations.ts
│   ├── types/                 TypeScript definitions
│   ├── MainPage.tsx           Swipe discovery feed (home tab)
│   ├── Cart.tsx               Shopping cart
│   ├── Search.tsx             Brand/product search
│   ├── Favorites.tsx          Liked items
│   ├── Wall.tsx               User profile + orders
│   └── Settings.tsx           App settings
```

## Navigation

### Auth flow

Phase-based flow managed by `AppContent` in `App.tsx`:

1. **Boot** — splash screen, token check
2. **Welcome** — login / signup overlays
3. **Email verification** — 6-digit code
4. **Profile setup** — gender selection, avatar, favorite brands, favorite styles
5. **Main** — bottom tab navigator

### Main tabs

5 bottom tabs with a custom tab bar:

| Tab | Screen | Description |
|---|---|---|
| Home | MainPage | Swipe card product discovery |
| Search | Search | Brand and product search |
| Cart | Cart | Shopping cart with checkout |
| Favorites | Favorites | Liked / saved items |
| Wall | Wall | User profile, orders, friends |

### Detail screens

Pushed on the stack from within tabs:

- **RecentPieces** — recently swiped products
- **FriendRecommendations** — recommendations for a friend's size/taste
- **FriendLikedItems** — items a friend has liked (progressive blur)

## Key features

- **Swipe discovery** — Tinder-style product cards with flip animation, size/color selection, like/dislike gestures
- **Social / friends** — friend requests, view friends' likes and recommendations, progressive blur effect
- **Cart and orders** — persistent cart (AsyncStorage), YooKassa payment redirect, order tracking with push notifications
- **Auth** — JWT stored in SecureStore, 30-second profile cache, automatic token refresh, 401 event-based logout
- **Push notifications** — Expo push tokens registered via API, order status updates
- **Deep linking** — `polka://` custom scheme for product sharing
- **Theme** — light / dark / system, persisted to AsyncStorage (`@polka_theme_mode`)
- **Accessibility** — reduced motion support via `useMotion()` hook and `withReducedMotion()` helper
- **Haptic feedback** — via expo-haptics on interactive elements

## EAS build profiles

Defined in `eas.json`:

| Profile | Platform | Use |
|---|---|---|
| `development` | iOS (simulator) | Local dev builds |
| `preview` | iOS / Android | Internal testing |
| `production` | iOS / Android | App Store / Play Store |

Commands from `package.json`:

```bash
yarn workspace polkamobile build:dev           # iOS dev build (EAS cloud)
yarn workspace polkamobile build:preview       # iOS preview
yarn workspace polkamobile build:prod          # iOS production
yarn workspace polkamobile build:android:dev   # Android dev
yarn workspace polkamobile build:android:preview
yarn workspace polkamobile build:android:prod
yarn workspace polkamobile build:dev:local      # iOS dev build (local)
yarn workspace polkamobile build:preview:local  # iOS preview build (local)
```

## App Store submission

### iOS

- Bundle ID: `com.danyvsthewrld.PolkaMobile`
- EAS project ID: `74d77e39-6b44-4eab-ba2a-5a9a5afb5968`
- Requires Apple Developer account ($99/year)
- Build: `yarn workspace polkamobile build:prod`
- Submit: `eas submit --platform ios`
- Checklist: screenshots (6.7" + 5.5"), Russian app description, privacy policy URL, App Review guidelines compliance

### Android

- Package: `com.danyvsthewrld.PolkaMobile`
- Requires Google Play Developer account ($25 one-time)
- Build: `yarn workspace polkamobile build:android:prod`
- Submit: `eas submit --platform android`

### OTA updates

Runtime version policy: `appVersion`. Update channel per environment.

```bash
yarn workspace polkamobile publish:dev         # Push to development channel
yarn workspace polkamobile publish:preview     # Push to preview channel
yarn workspace polkamobile publish:prod        # Push to production channel
```

Updates URL: `https://u.expo.dev/74d77e39-6b44-4eab-ba2a-5a9a5afb5968`

## App config notes

From `app.json`:

- Orientation: portrait only
- `userInterfaceStyle`: automatic (follows system)
- `newArchEnabled`: true
- Custom scheme: `polka` (deep links)
- Plugins: expo-web-browser, expo-build-properties, expo-secure-store, expo-notifications
- Fonts: IgraSans, REM-Regular

## Testing

```bash
yarn workspace polkamobile test      # Jest in watch mode
```

Uses `jest-expo` preset. Test suite is in early stages.

## Notes

- UI text is in Russian.
- Install new Expo packages with `npx expo install <pkg>` from `packages/mobile` (for SDK version pinning), then `yarn install` from the monorepo root.
