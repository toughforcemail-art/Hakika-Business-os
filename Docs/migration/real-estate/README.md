# Real Estate migration foundation

This contract prepares the new Real Estate vertical slice for audited legacy migration. It does not migrate legacy pages or data. `Scaffolded` means structure exists only; no page may be marked `Implemented` until behavior is tested against audited evidence.

Authoritative runtime boundaries remain the existing Supabase SSR client, proxy, canonical application-access service, RLS policies, Redis and `app-mfa` function.
