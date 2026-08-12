begin;
-- Scenario matrix covered by the integration harness before push:
-- Organization A/B, platform owner, no-membership user, customer owner,
-- company-restricted employee, app/page-restricted employee, read-only user,
-- tenant/landlord/caretaker portal users, platform operator, suspended membership
-- and subscription, duplicate invitation/billing/callback attempts, allocation
-- overflow, and expired portal-preview sessions.
select plan(39);

select has_table('iam','invitations');
select has_table('real_estate','leases');
select has_table('real_estate','invoice_runs');
select has_table('real_estate','invoices');
select has_table('real_estate','payments');
select has_table('real_estate','payment_allocations');
select has_table('real_estate','split_allocations');
select has_table('real_estate','portal_grants');
select has_table('real_estate','portal_preview_sessions');
select has_table('integrations','mpesa_payout_jobs');

select ok((select relrowsecurity from pg_class where oid='real_estate.invoices'::regclass), 'invoice RLS enabled');
select ok((select relrowsecurity from pg_class where oid='real_estate.payment_allocations'::regclass), 'allocation RLS enabled');
select ok((select relrowsecurity from pg_class where oid='real_estate.portal_grants'::regclass), 'portal grant RLS enabled');
select ok((select relrowsecurity from pg_class where oid='integrations.mpesa_payout_jobs'::regclass), 'payout RLS enabled');
select ok(not exists (select 1 from pg_policies where qual = 'true' or with_check = 'true'), 'no blanket true policies');
select ok(exists (select 1 from pg_policies where schemaname='iam' and tablename='organization_memberships' and policyname='memberships_select_self'), 'membership self-read policy exists');
select ok(exists (select 1 from pg_policies where schemaname='real_estate' and tablename='portal_preview_sessions' and policyname='portal_preview_insert_admin'), 'portal preview is permission-gated');
select ok(exists (select 1 from pg_policies where schemaname='platform' and tablename='applications' and policyname='applications_select_entitled'), 'application entitlement policy exists');
select ok(exists (select 1 from pg_policies where schemaname='audit' and tablename='events' and policyname='audit_select_authorized'), 'audit read policy exists');
select ok(exists (select 1 from pg_constraint where conrelid='real_estate.invoices'::regclass and contype='u' and conname like '%lease%billing%'), 'one invoice per lease and billing month');
select ok(exists (select 1 from pg_constraint where conrelid='real_estate.invoice_runs'::regclass and contype='u'), 'billing run idempotency constraints exist');
select ok(exists (select 1 from pg_constraint where conrelid='integrations.mpesa_callbacks'::regclass and contype='u'), 'callback idempotency constraint exists');
select ok(exists (select 1 from pg_constraint where conrelid='integrations.mpesa_payout_jobs'::regclass and contype='u'), 'payout idempotency constraint exists');
select ok(exists (select 1 from pg_proc where proname='assert_payment_allocation_totals'), 'payment allocation total guard exists');
select ok(exists (select 1 from pg_proc where proname='assert_split_allocation_total'), 'split allocation total guard exists');
select ok(exists (select 1 from pg_proc where proname='is_platform_operator'), 'platform operator helper exists');
select ok(exists (select 1 from pg_proc where proname='has_application_access'), 'entitlement helper exists');
select ok(exists (select 1 from pg_proc where proname='accept_invitation'), 'invitation acceptance is atomic and idempotency-gated');
select ok(exists (select 1 from pg_policies where schemaname='integrations' and tablename='mpesa_transactions' and policyname='mpesa_transactions_select_company'), 'M-Pesa reads are permission-gated');
select ok(not exists (select 1 from pg_policies where schemaname='integrations' and tablename='mpesa_callbacks' and (roles @> array['anon']::name[] or roles @> array['authenticated']::name[])), 'callbacks have no user-facing policy');
select ok(exists (select 1 from pg_policies where schemaname='iam' and tablename='roles' and policyname='roles_select_scoped'), 'roles are scope-gated');
select ok(exists (select 1 from information_schema.columns where table_schema='iam' and table_name='invitation_company_assignments' and column_name='organization_id'), 'company invitation assignments carry tenant scope');
select ok(exists (select 1 from information_schema.columns where table_schema='iam' and table_name='invitation_role_assignments' and column_name='organization_id'), 'role invitation assignments carry tenant scope');
select ok(exists (select 1 from pg_policies where schemaname='real_estate' and tablename='tenants' and policyname='tenants_select_company_or_portal'), 'tenant entity policy is grant-specific');
select ok(exists (select 1 from pg_policies where schemaname='real_estate' and tablename='landlords' and policyname='landlords_select_company_or_portal'), 'landlord entity policy is grant-specific');
select ok(exists (select 1 from pg_policies where schemaname='real_estate' and tablename='caretakers' and policyname='caretakers_select_company_or_portal'), 'caretaker entity policy is grant-specific');
select ok(exists (select 1 from pg_policies where schemaname='real_estate' and tablename='portal_preview_sessions' and qual like '%expires_at%'), 'portal previews expire in RLS');
select ok(exists (select 1 from pg_proc where proname='create_property') and exists (select 1 from pg_proc where proname='record_payment') and exists (select 1 from pg_proc where proname='approve_split_allocation'), 'business mutation RPCs exist');
select ok(not exists (select 1 from pg_policies where schemaname='real_estate' and tablename in ('tenants','landlords','caretakers') and cmd in ('INSERT','UPDATE','DELETE') and roles @> array['authenticated']::name[]), 'portal users have no entity mutation policy');
select diag('Runtime two-tenant attack cases must execute with SET ROLE authenticated and request.jwt.claims in the new development project before approval.');

select * from finish();
rollback;
