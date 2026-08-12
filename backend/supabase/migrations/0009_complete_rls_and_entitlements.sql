begin;

create or replace function private.is_platform_operator() returns boolean language sql stable security definer set search_path = pg_catalog, iam, platform as $$ select exists (select 1 from iam.organization_memberships om join platform.organizations o on o.id=om.organization_id join iam.member_app_roles mar on mar.organization_membership_id=om.id join iam.role_permissions rp on rp.role_id=mar.role_id join iam.permissions p on p.id=rp.permission_id where om.user_id=auth.uid() and om.status='active' and o.organization_type='platform_owner' and p.permission_key='platform.audit.read'); $$;
create or replace function private.has_application_access(target_org uuid, wanted_app text) returns boolean language sql stable security definer set search_path = pg_catalog, iam, platform, billing as $$
  select private.is_platform_operator() or exists (
    select 1
    from iam.organization_memberships om
    join platform.applications a on a.application_key=wanted_app
    left join billing.application_subscriptions s on s.organization_id=om.organization_id and s.application_id=a.id
    where om.user_id=auth.uid()
      and om.status='active'
      and (target_org is null or om.organization_id=target_org)
      and ((a.is_core and wanted_app <> 'PLATFORM_ADMIN') or s.status in ('trial','active','grace'))
  );
$$;
create or replace function private.has_permission(target_org uuid, target_company uuid, wanted text) returns boolean language sql stable security definer set search_path = pg_catalog, iam, platform, billing as $$ select exists (select 1 from iam.organization_memberships om join iam.member_app_roles mar on mar.organization_membership_id=om.id join iam.role_permissions rp on rp.role_id=mar.role_id join iam.permissions p on p.id=rp.permission_id join platform.applications a on a.id=mar.application_id left join billing.application_subscriptions s on s.organization_id=target_org and s.application_id=a.id where om.organization_id=target_org and om.user_id=auth.uid() and om.status='active' and (mar.company_id is null or mar.company_id=target_company) and mar.valid_from<=now() and (mar.valid_until is null or mar.valid_until>now()) and (a.application_key='PLATFORM_ADMIN' and private.is_platform_operator() or a.application_key<>'PLATFORM_ADMIN' and (a.is_core or s.status in ('trial','active','grace'))) and p.permission_key=wanted); $$;
create or replace function private.accept_invitation(invitation_token_hash text) returns uuid language plpgsql security definer set search_path = pg_catalog, iam, platform, audit as $$ declare accepted_id uuid; membership_id uuid; invitation_org uuid; begin if auth.uid() is null then raise exception 'authenticated user required'; end if; update iam.invitations set status='accepted', accepted_by=auth.uid(), accepted_at=now() where token_hash=invitation_token_hash and status='pending' and expires_at>now() returning id, organization_id into accepted_id, invitation_org; if accepted_id is null then raise exception 'invitation is invalid, expired, revoked or already accepted'; end if; insert into iam.organization_memberships (organization_id,user_id,status,joined_at) values (invitation_org,auth.uid(),'active',now()) on conflict (organization_id,user_id) do update set status='active' returning id into membership_id; insert into iam.company_memberships (organization_membership_id,organization_id,company_id,status) select membership_id,invitation_org,ica.company_id,'active' from iam.invitation_company_assignments ica where ica.invitation_id=accepted_id on conflict (organization_membership_id,company_id) do update set status='active'; insert into iam.member_app_roles (organization_membership_id,organization_id,company_id,application_id,role_id) select membership_id,invitation_org,ica.company_id,ira.application_id,ira.role_id from iam.invitation_role_assignments ira left join iam.invitation_company_assignments ica on ica.invitation_id=ira.invitation_id where ira.invitation_id=accepted_id and (ica.company_id is not null or not exists (select 1 from iam.invitation_company_assignments x where x.invitation_id=accepted_id)) and exists (select 1 from iam.roles r where r.id=ira.role_id and (r.organization_id is null or r.organization_id=invitation_org) and (r.application_id is null or r.application_id=ira.application_id)) on conflict (organization_membership_id,company_id,application_id,role_id) do nothing; insert into audit.events (actor_user_id,organization_id,application_key,action_key,outcome,entity_type,entity_id,summary) values (auth.uid(),invitation_org,'CUSTOMER_ADMIN','invitation.accepted','success','invitation',accepted_id,'Invitation accepted and access assignments provisioned'); return accepted_id; end; $$;

revoke all on function private.is_platform_operator() from public;
revoke all on function private.has_application_access(uuid,text) from public;
grant execute on function private.is_platform_operator() to authenticated;
grant execute on function private.has_application_access(uuid,text) to authenticated;
revoke all on function private.accept_invitation(text) from public;
grant execute on function private.accept_invitation(text) to authenticated;

revoke all on schema private from public;
grant usage on schema platform, iam, billing, audit, real_estate, communications to authenticated;
revoke all on schema integrations from anon, authenticated;

alter table platform.applications enable row level security;
alter table iam.pages enable row level security;
alter table iam.permissions enable row level security;
alter table iam.roles enable row level security;
alter table iam.role_permissions enable row level security;
alter table iam.member_app_roles enable row level security;
alter table iam.invitations enable row level security;
alter table iam.invitation_company_assignments enable row level security;
alter table iam.invitation_role_assignments enable row level security;
alter table billing.plans enable row level security;
alter table real_estate.leases enable row level security;
alter table real_estate.tenants enable row level security;
alter table real_estate.landlords enable row level security;
alter table real_estate.caretakers enable row level security;
alter table real_estate.invoice_runs enable row level security;
alter table real_estate.invoices enable row level security;
alter table real_estate.invoice_items enable row level security;
alter table real_estate.payments enable row level security;
alter table real_estate.payment_allocations enable row level security;
alter table real_estate.split_rules enable row level security;
alter table real_estate.split_rule_versions enable row level security;
alter table real_estate.split_allocations enable row level security;
alter table real_estate.portal_grants enable row level security;
alter table real_estate.portal_preview_sessions enable row level security;
alter table integrations.mpesa_transactions enable row level security;
alter table integrations.mpesa_payout_jobs enable row level security;

create policy applications_select_entitled on platform.applications for select to authenticated using (private.has_application_access(null, application_key));
create policy pages_select_entitled on iam.pages for select to authenticated using (exists (select 1 from platform.applications a where a.id=application_id and private.has_application_access(null,a.application_key)));
create policy permissions_select_entitled on iam.permissions for select to authenticated using (application_id is null or exists (select 1 from platform.applications a where a.id=application_id and private.has_application_access(null,a.application_key)));
create policy roles_select_scoped on iam.roles for select to authenticated using ((organization_id is null and private.is_platform_operator()) or (organization_id is not null and private.has_org_access(organization_id)));
create policy role_permissions_select_scoped on iam.role_permissions for select to authenticated using (exists (select 1 from iam.roles r where r.id=role_id and ((r.organization_id is null and private.is_platform_operator()) or (r.organization_id is not null and private.has_org_access(r.organization_id)))));
create policy member_app_roles_select_scoped on iam.member_app_roles for select to authenticated using (private.has_org_access(organization_id) and (organization_membership_id in (select id from iam.organization_memberships where user_id=auth.uid()) or private.has_permission(organization_id,company_id,'admin.roles.read')));
create policy invitations_select_org_admin on iam.invitations for select to authenticated using (private.has_permission(organization_id,null,'admin.members.read') or private.has_permission(organization_id,null,'admin.members.invite'));
create policy invitation_companies_select_org_admin on iam.invitation_company_assignments for select to authenticated using (exists (select 1 from iam.invitations i where i.id=invitation_id and private.has_org_access(i.organization_id)));
create policy invitation_roles_select_org_admin on iam.invitation_role_assignments for select to authenticated using (exists (select 1 from iam.invitations i where i.id=invitation_id and private.has_org_access(i.organization_id)));
create policy plans_select_entitled on billing.plans for select to authenticated using (status='active' and exists (select 1 from billing.application_subscriptions s where s.plan_id=id and private.has_org_access(s.organization_id)) or private.is_platform_operator());

create policy leases_select_company on real_estate.leases for select to authenticated using (private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.leases.read'));
create policy tenants_select_company_or_portal on real_estate.tenants for select to authenticated using ((private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.tenants.read')) or exists (select 1 from real_estate.portal_grants g where g.organization_id=real_estate.tenants.organization_id and g.user_id=auth.uid() and g.portal_type='tenant' and g.entity_id=real_estate.tenants.id and g.status='active'));
create policy landlords_select_company_or_portal on real_estate.landlords for select to authenticated using ((private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.landlords.read')) or exists (select 1 from real_estate.portal_grants g where g.organization_id=real_estate.landlords.organization_id and g.user_id=auth.uid() and g.portal_type='landlord' and g.entity_id=real_estate.landlords.id and g.status='active'));
create policy caretakers_select_company_or_portal on real_estate.caretakers for select to authenticated using ((private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.caretakers.read')) or exists (select 1 from real_estate.portal_grants g where g.organization_id=real_estate.caretakers.organization_id and g.user_id=auth.uid() and g.portal_type='caretaker' and g.entity_id=real_estate.caretakers.id and g.status='active'));
create policy invoice_runs_select_company on real_estate.invoice_runs for select to authenticated using (private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.billing.read'));
create policy invoices_select_company on real_estate.invoices for select to authenticated using (private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.invoices.read'));
create policy invoice_items_select_org on real_estate.invoice_items for select to authenticated using (private.has_org_access(organization_id));
create policy payments_select_company on real_estate.payments for select to authenticated using (private.has_company_access(organization_id,company_id) and private.has_permission(organization_id,company_id,'real_estate.payments.read'));
create policy payment_allocations_select_org on real_estate.payment_allocations for select to authenticated using (private.has_org_access(organization_id));
create policy split_rules_select_company on real_estate.split_rules for select to authenticated using (private.has_company_access(organization_id,company_id));
create policy split_versions_select_org on real_estate.split_rule_versions for select to authenticated using (private.has_org_access(organization_id));
create policy split_allocations_select_org on real_estate.split_allocations for select to authenticated using (private.has_org_access(organization_id));

create policy portal_grants_select_self_or_admin on real_estate.portal_grants for select to authenticated using ((user_id=auth.uid() and status='active') or private.has_permission(organization_id,null,'real_estate.tenant_portal.preview'));
create policy portal_preview_select_admin on real_estate.portal_preview_sessions for select to authenticated using (expires_at>now() and revoked_at is null and (admin_user_id=auth.uid() or private.has_permission(organization_id,null,'real_estate.tenant_portal.preview')));
create policy portal_preview_insert_admin on real_estate.portal_preview_sessions for insert to authenticated with check (admin_user_id=auth.uid() and private.has_permission(organization_id,null,'real_estate.tenant_portal.preview'));

create policy mpesa_transactions_select_company on integrations.mpesa_transactions for select to authenticated using (organization_id is not null and private.has_permission(organization_id,null,'real_estate.mpesa.read'));
create policy mpesa_payouts_select_company on integrations.mpesa_payout_jobs for select to authenticated using (private.has_permission(organization_id,null,'real_estate.payouts.read'));

create or replace function real_estate.create_property(p_organization_id uuid, p_company_id uuid, p_name text, p_property_code text) returns uuid language plpgsql security definer set search_path = pg_catalog, real_estate, private, audit as $$ declare new_id uuid; begin if not private.has_permission(p_organization_id,p_company_id,'real_estate.properties.create') then raise exception 'property create permission denied'; end if; insert into real_estate.properties (organization_id,company_id,name,property_code,created_by) values (p_organization_id,p_company_id,p_name,p_property_code,auth.uid()) returning id into new_id; insert into audit.events (actor_user_id,organization_id,company_id,application_key,action_key,outcome,entity_type,entity_id,entity_label,summary) values (auth.uid(),p_organization_id,p_company_id,'REAL_ESTATE','property.created','success','property',new_id,p_name,'Property created'); return new_id; end; $$;
create or replace function real_estate.record_payment(p_organization_id uuid, p_company_id uuid, p_reference text, p_amount_minor bigint) returns uuid language plpgsql security definer set search_path = pg_catalog, real_estate, private, audit as $$ declare new_id uuid; begin if not private.has_permission(p_organization_id,p_company_id,'real_estate.payments.create') then raise exception 'payment create permission denied'; end if; insert into real_estate.payments (organization_id,company_id,payment_reference,amount_minor) values (p_organization_id,p_company_id,p_reference,p_amount_minor) returning id into new_id; insert into audit.events (actor_user_id,organization_id,company_id,application_key,action_key,outcome,entity_type,entity_id,entity_label,summary) values (auth.uid(),p_organization_id,p_company_id,'REAL_ESTATE','payment.recorded','success','payment',new_id,p_reference,'Payment recorded'); return new_id; end; $$;
create or replace function real_estate.approve_split_allocation(p_organization_id uuid, p_allocation_id uuid) returns void language plpgsql security definer set search_path = pg_catalog, real_estate, private, audit as $$ declare allocation_company uuid; begin select company_id into allocation_company from real_estate.split_allocations where id=p_allocation_id and organization_id=p_organization_id; if allocation_company is null or not private.has_permission(p_organization_id,allocation_company,'real_estate.payouts.approve') then raise exception 'split approval permission denied'; end if; update real_estate.split_allocations set status='approved' where id=p_allocation_id and organization_id=p_organization_id; insert into audit.events (actor_user_id,organization_id,company_id,application_key,action_key,outcome,entity_type,entity_id,summary) values (auth.uid(),p_organization_id,allocation_company,'REAL_ESTATE','split.approved','success','split_allocation',p_allocation_id,'Split allocation approved'); end; $$;
revoke all on function real_estate.create_property(uuid,uuid,text,text) from public;
revoke all on function real_estate.record_payment(uuid,uuid,text,bigint) from public;
revoke all on function real_estate.approve_split_allocation(uuid,uuid) from public;
grant execute on function real_estate.create_property(uuid,uuid,text,text) to authenticated;
grant execute on function real_estate.record_payment(uuid,uuid,text,bigint) to authenticated;
grant execute on function real_estate.approve_split_allocation(uuid,uuid) to authenticated;

revoke insert, update, delete on integrations.mpesa_accounts, integrations.mpesa_callbacks, integrations.mpesa_transactions, integrations.mpesa_payout_jobs from anon, authenticated;
revoke update, delete on audit.events from anon, authenticated;

commit;
