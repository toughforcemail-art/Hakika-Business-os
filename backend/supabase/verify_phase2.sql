select jsonb_build_object(
  'migrations', (select jsonb_agg(version order by version) from supabase_migrations.schema_migrations where version in ('0001','0002','0003','0004','0005','0006','0007','0008','0009','0010')),
  'required_tables', (select jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'rls',c.relrowsecurity) order by schemaname,tablename)
    from pg_tables t join pg_class c on c.relname=t.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname=t.schemaname
    where (schemaname,tablename) in (('platform','organizations'),('platform','companies'),('platform','applications'),('platform','provisioning_events'),('iam','organization_memberships'),('iam','company_memberships'),('iam','member_app_roles'),('billing','application_subscriptions'),('audit','events'))),
  'required_functions', (select jsonb_agg(proname order by proname) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','platform') and proname in ('has_org_access','has_company_access','has_application_access','has_permission','is_platform_operator','provision_organization','set_application_subscription_status')),
  'policy_count', (select count(*) from pg_policies where schemaname in ('platform','iam','billing','audit','real_estate','integrations','communications'))
) as phase2_verification;
