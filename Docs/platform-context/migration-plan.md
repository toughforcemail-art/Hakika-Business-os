# Migration plan

`0020_platform_context_scope_mode.sql` is additive: it adds `platform.organizations.company_scope_mode`, validates its values, makes Real Estate company columns nullable, and updates shared access evaluation. Verify with `supabase migration list` and `supabase db push --dry-run` before applying. Do not create seed organizations, users, invoices, or notifications as part of context migration.
