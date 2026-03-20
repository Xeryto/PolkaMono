# Polka Frontend

Public landing page, brand seller dashboard, and admin panel for the Polka fashion marketplace.

Part of the [Polka monorepo](../../README.md).

## Tech stack

- Vite 5.4 + React 18.3 + TypeScript 5.8
- Tailwind CSS 3.4
- shadcn/ui (Radix primitives + CVA)
- React Router 6.30
- TanStack React Query 5.83
- React Hook Form 7.61 + Zod 3.25
- Recharts 2.15 (statistics charts)
- Lucide React (icons)

## Setup

From the monorepo root:

```bash
yarn install:all
cp packages/frontend/.env.example packages/frontend/.env
# Edit .env — set VITE_API_URL to your running API
yarn start:frontend       # Vite dev server on http://localhost:8080
```

## Environment variables

From `.env.example`:

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | API server URL |
| `VITE_ENVIRONMENT` | `development` | `development` / `staging` / `production` |
| `VITE_APP_NAME` | `Polka Frontend` | Application display name |
| `VITE_APP_VERSION` | `1.0.0` | Version string |
| `VITE_API_TIMEOUT` | `10000` | API request timeout (ms) |
| `VITE_AUTH_TIMEOUT` | `20000` | Auth request timeout (ms) |
| `VITE_DEBUG_MODE` | `true` | Enable debug logging |
| `VITE_LOG_LEVEL` | `debug` | Log level |

## Routes

| Path | Auth | Description |
|---|---|---|
| `/` | no | Public landing page — app marketing, email waitlist signup |
| `/portal` | no | Brand login with 2FA/OTP |
| `/portal/forgot-password` | no | Brand password reset request |
| `/portal/reset-password` | no | Brand password reset with code |
| `/dashboard` | brand | Brand seller dashboard (sidebar: stats, orders, products, add item, profile, security) |
| `/statistics` | brand | Brand statistics view |
| `/admin` | no | Admin login with OTP |
| `/admin/dashboard` | admin | Admin panel (notifications, orders/returns, inflow, withdrawals, brands) |
| `*` | — | 404 |

Protected routes redirect to `/portal` (brands) or `/admin` (admins) when unauthenticated.

## Application areas

### Landing page (`/`)

Public-facing marketing page. Dark/light theme toggle. Email signup for exclusive early access. Links to brand portal.

### Brand dashboard (`/dashboard`)

Protected — requires brand JWT. Sidebar navigation between views:

- **Stats** — sales and performance charts
- **Orders** — order list with status management, tracking
- **Products** — product catalog with detail modals
- **Add item** — new product creation form
- **Profile** — brand profile settings, logo/image cropping
- **Security** — password change, 2FA management

### Admin panel (`/admin/dashboard`)

Protected — requires admin JWT. Sidebar navigation:

- **Notifications** — send push notifications to users
- **Orders / Returns** — order lookup, return logging
- **Inflow** — financial inflow tracking
- **Withdrawals** — brand payout management
- **Brands** — brand CRUD, activate/deactivate, search

## Project structure

```
packages/frontend/src/
├── App.tsx                 Routes
├── main.tsx                Entry point with providers
├── pages/
│   ├── Landing.tsx         Public landing
│   ├── Portal.tsx          Brand login + OTP
│   ├── Dashboard.tsx       Brand dashboard (multi-view)
│   ├── StatisticsPage.tsx
│   ├── BrandForgotPasswordPage.tsx
│   ├── BrandResetPasswordPage.tsx
│   ├── AdminLogin.tsx
│   ├── OrderDetailsPage.tsx
│   ├── ProfileSettingsPage.tsx
│   ├── SecuritySettingsPage.tsx
│   ├── NotFound.tsx
│   └── admin/              Admin sub-pages
├── components/
│   ├── ProtectedRoute.tsx      Brand auth guard
│   ├── AdminProtectedRoute.tsx Admin auth guard
│   ├── DashboardSidebar.tsx
│   ├── OrdersView, ProductsView, StatsView, ...
│   └── ui/                 shadcn/ui primitives (38+ components)
├── context/
│   ├── AuthContext.tsx      Brand auth (localStorage)
│   └── AdminAuthContext.tsx Admin auth (localStorage)
├── services/
│   ├── api.ts              Brand API calls
│   ├── adminApi.ts         Admin API calls
│   └── networkUtils.ts
├── hooks/                  use-toast, use-mobile
├── lib/                    utils, translations, currency, orderStatus, materials, colors, sizes
└── config/
    └── environment.ts      Env var config
```

## Deployment

Multi-stage Dockerfile:

1. **Builder** (node:20-alpine) — accepts `VITE_API_URL` and `VITE_ENVIRONMENT` as build args, runs `yarn build`
2. **Production** (nginx-alpine) — serves static files on port 80 with SPA fallback (`try_files $uri /index.html`)

```bash
docker build \
  --build-arg VITE_API_URL=https://api.polka.example \
  --build-arg VITE_ENVIRONMENT=production \
  -t polka-frontend .

docker run -p 80:80 polka-frontend
```

## Development

- Path alias: `@` maps to `src/`
- Linting: `yarn workspace polka-frontend lint` (ESLint 9 + typescript-eslint)
- Dev server: `yarn workspace polka-frontend dev` (alias for `vite`)
- UI text is in Russian
