begin;

insert into iam.role_permissions (role_id, permission_id)
select r.id, p.id
from iam.roles r
cross join iam.permissions p
where p.permission_key = 'communications.sms.send'
  and r.is_read_only = false
  and (r.role_key = 'platform_admin' or r.role_key = 'customer_admin' or r.role_key like '%_admin')
on conflict (role_id, permission_id) do nothing;

commit;
