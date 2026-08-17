begin;

create table if not exists iam.employee_invitations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, email citext not null, phone text, token_hash text not null unique,
 status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')), expires_at timestamptz not null,
 created_by uuid references auth.users(id) on delete set null, accepted_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(),
 foreign key (organization_id) references platform.organizations(id) on delete restrict
);
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='iam.employee_invitations'::regclass and conname='employee_invitations_org_id_key') then alter table iam.employee_invitations add constraint employee_invitations_org_id_key unique (organization_id,id); end if;
end $$;
create table if not exists iam.invitation_application_assignments (
 organization_id uuid not null, invitation_id uuid not null, application_id uuid not null, access_mode text not null default 'standard',
 primary key (invitation_id, application_id), foreign key (organization_id,invitation_id) references iam.employee_invitations(organization_id,id) on delete cascade, foreign key (application_id) references platform.applications(id) on delete restrict
);
create table if not exists iam.member_page_permissions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, membership_id uuid not null, page_id uuid not null,
 access_mode text not null default 'read_only', expires_at timestamptz, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 unique (organization_id,membership_id,page_id), foreign key (organization_id) references platform.organizations(id) on delete restrict
);
create table if not exists iam.member_permission_overrides (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, membership_id uuid not null, permission_id uuid not null,
 effect text not null check (effect in ('grant','revoke')), expires_at timestamptz, created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(),
 unique (organization_id,membership_id,permission_id), foreign key (organization_id) references platform.organizations(id) on delete restrict
);

alter table iam.employee_invitations enable row level security;
alter table iam.invitation_application_assignments enable row level security;
alter table iam.member_page_permissions enable row level security;
alter table iam.member_permission_overrides enable row level security;

create policy employee_invitations_select on iam.employee_invitations for select to authenticated using (private.has_org_access(organization_id) and private.has_permission(organization_id,null,'admin.members.read'));
create policy invitation_application_assignments_select on iam.invitation_application_assignments for select to authenticated using (private.has_org_access(organization_id));
create policy member_page_permissions_select on iam.member_page_permissions for select to authenticated using (private.has_org_access(organization_id));
create policy member_permission_overrides_select on iam.member_permission_overrides for select to authenticated using (private.has_org_access(organization_id));

commit;
