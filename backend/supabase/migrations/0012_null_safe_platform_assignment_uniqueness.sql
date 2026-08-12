begin;

-- Keep the oldest equivalent assignment where NULL company scope bypassed the
-- original UNIQUE constraint, then prevent that condition from recurring.
with duplicates as (
  select id,
         row_number() over (
           partition by organization_membership_id, company_id, application_id, role_id
           order by created_at, id
         ) as duplicate_number
  from iam.member_app_roles
  where company_id is null
)
delete from iam.member_app_roles mar
using duplicates d
where mar.id = d.id and d.duplicate_number > 1;

create unique index if not exists member_app_roles_null_safe_unique
  on iam.member_app_roles (
    organization_membership_id,
    coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
    application_id,
    role_id
  );

commit;
