# Hakika frontend

Next.js App Router entrypoints for the public website, account entry surfaces, launcher and application shells. Routes are thin adapters; application logic belongs under `src/applications/` as those vertical slices are added.

The current Phase 1 UI is intentionally empty-state friendly and uses local supplied brand artwork under `public/brands/`. No legacy data is imported.

Copy `.env.example` to `.env.local` for browser-safe Supabase configuration. Frontend environment variables must use the `NEXT_PUBLIC_` prefix and must never contain service-role credentials.

Authentication cookies are owned exclusively by `@supabase/ssr`; the application does not create profile, permission, subscription, organization, JWT, or session JSON cookies. In development, the proxy expires obsolete Supabase auth-cookie names from a previous project while preserving the current project cookie. If an old cookie remains outside development, use a fresh Incognito window or clear cookies for `localhost` only.

The development server allows a temporarily larger 256 KB request-header limit so an obsolete cookie header can reach the proxy once and be expired. Restart `npm run dev` after changing projects; production keeps its normal platform header limits and does not broadly delete cookies.
