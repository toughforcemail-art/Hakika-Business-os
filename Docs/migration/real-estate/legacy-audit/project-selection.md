# Project Selection

## Selected Project
**Path:** `C:\Users\evince\Downloads\omniguard-operations-hub`
**Framework:** React 19 + TypeScript
**Build tool:** Vite
**Package manager:** npm
**Router:** React Router v6 (BrowserRouter, lazy-loaded routes)
**Supabase client:** `frontend/src/utils/supabase.ts` (standard `createClient`)
**Styling:** TailwindCSS + custom brand tokens (`brand-purple`, `brand-pink`)
**Charts:** Recharts (AreaChart used on dashboard)
**State:** Local useState/useEffect + lightweight `cache` utility + AccessContext

## Real Estate Route Entry Points (App.tsx)
- `/app/real-estate/*` → `AppContent` → `AppContent` routes block
- `/app/tenant/*` → `TenantAppContent` (tenant portal)
- `/app/landlord/*` → `LandlordAppContent` (landlord portal)
- `/app/caretaker/dashboard` → `CaretakerDashboardPage`
- `/app/platform-preview/apps/real-estate/*` → `PlatformHostedApplicationShell`

## Alternatives Considered

| Path | Status | Reason not selected |
|------|--------|---------------------|
| `C:\Users\evince\Downloads\omniguard-operations-hub(1) (1)` | Not inspected | Current workspace is the active development copy per conversation history |
| `C:\Users\evince\Projects\Hakika-Business-OS` | New project | Target, not source |
| `C:\Users\evince\Downloads\hakika-business-os` | New project | Target variant |

## Selection Evidence
- Conversation history confirms this is the active repo (`kihiu254/Tough-Force`, branch `main`)
- Contains 48 Real Estate page components under `frontend/src/pages/real-estate/`
- Has active Supabase config in `backend/.env.local`
- Has Vercel deployment config (`.vercel/project.json`)
- Has extensive documentation in `docs/` and `documents/`
- Git history available (not inspected per read-only constraint)

## Framework Details
```
React: 19.x
TypeScript: ~5.x
Vite: ~5.x
React Router: v6
TailwindCSS: v3
Recharts: ~2.x
Supabase JS: v2
```

## Supabase Configuration
- Client initialized in `frontend/src/utils/supabase.ts`
- URL and anon key from `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
- Auth: Supabase Auth (JWT, email/password)
- Storage: `UnifiedStorageService` wrapping Supabase Storage + ImageKit fallback
- Edge Functions: invoked via `invokeEdgeFunction` utility
- Realtime: used on InvoiceList (postgres_changes on re_invoices, re_payments, mpesa_transactions)

## Module Routing
`resolveModuleFromPath()` maps `/app/real-estate/*` → `REAL_ESTATE` module.
`resolveModuleFromProfile()` maps profile.module `hakika` | `real_estate` | `real-estate` → `REAL_ESTATE`.
