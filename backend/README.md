# Hakika backend

Supabase migrations and privileged workflow boundaries for the clean rebuild. Run all Supabase CLI commands from this directory.

SMS provider boundary

Africa's Talking credentials are server-only backend environment variables: `AFRICASTALKING_USERNAME` and `AFRICASTALKING_API_KEY`. Never expose them through `NEXT_PUBLIC_*`, browser bundles, client errors or committed files. Supabase Auth MFA remains the authority for authentication and verification; any Africa's Talking SMS/WhatsApp notification adapter must run server-side and must not create a parallel OTP table.

The SMS adapter normalizes Kenyan destinations automatically to `+254XXXXXXXXX` before calling Africa's Talking. Explicit international E.164 destinations are preserved. Invalid destinations are rejected before a provider request is made.

## Safety gate

The linked project must remain `upvupkuokinwqwsfxyxy` and must match the new project URL in the root environment example. Do not link or push the legacy project. `supabase db push --dry-run` is required before any real push; a real push requires explicit approval in the task conversation.

## Migration order

1. `0001_extensions_schemas_helpers` — extensions, schemas and fixed-search-path helper.
2. `0002_platform_tenancy` — organizations, companies, profiles and memberships.
3. `0003_applications_iam_billing` — app registry, pages, permissions, roles, subscriptions and invitations.
4. `0004_audit` — immutable audit and low-risk UI telemetry.
5. `0005_real_estate_integrations_communications` — Phase 1 domain foundations and protected integration records.
6. `0006_rls_and_access_functions` — security-definer access helpers and baseline RLS policies.
7. `0007_seed_registry` — stable app/page/permission keys and system roles.
8. `0008_billing_portals_invariants` — invitations, billing/payment/split/portal foundations and allocation guards.
9. `0009_complete_rls_and_entitlements` — full Phase 1 RLS, platform/customer boundaries, entitlement checks and schema grants.

Each migration has rollback notes in `docs/database/rollback.md`; rollback is written as a review guide rather than an automatically destructive script.

## Supabase Send SMS Hook

The signed Supabase Auth Send SMS Edge Function is at `supabase/functions/send-sms/index.ts`. It accepts only Standard Webhooks-signed POST requests, validates E.164 phone numbers and OTPs, and sends the server-fixed message through Africa's Talking. It does not expose provider responses or accept arbitrary message content.

Run the mocked function tests with `npm run test:functions`. Deploy only after logging into the Supabase account that owns the target project:

```powershell
./scripts/deploy-send-sms.ps1
```

The script is locked to project `upvupkuokinwqwsfxyxy`, checks that the project is visible and that the four expected remote secret names exist, deploys with JWT verification disabled for the signed hook, and lists the deployed function. Configure the HTTPS Send SMS Auth Hook in the Supabase Dashboard after deployment; the URL is `https://upvupkuokinwqwsfxyxy.supabase.co/functions/v1/send-sms`. A separately approved signed OTP test is still required before calling the integration operational.

## Backend app_mfa service

Start the backend with its local ignored environment file:

```powershell
cd C:\Users\evince\Projects\Hakika-Business-OS\backend
npm start
```

Start the frontend in a second terminal:

```powershell
cd C:\Users\evince\Projects\Hakika-Business-OS\frontend
npm run dev
```

The frontend uses the non-secret `BACKEND_INTERNAL_URL` to proxy the same-origin `app_mfa` routes. Africa's Talking, Redis, HMAC, JWT verification and step-up cookies remain backend-owned.

Copy `.env.example` to `.env.local` for backend-only configuration. Backend secrets belong in the backend secret store or local ignored environment file and must never be copied into frontend source, migrations or logs.
