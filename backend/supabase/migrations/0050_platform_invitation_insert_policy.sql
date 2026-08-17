begin;

drop policy if exists invitations_write_org_admin on iam.invitations;
create policy invitations_write_org_admin on iam.invitations for all to authenticated
  using (
    private.is_platform_operator()
    or private.has_permission(organization_id, null, 'admin.members.invite')
  )
  with check (
    invited_by = auth.uid()
    and (
      private.is_platform_operator()
      or private.has_permission(organization_id, null, 'admin.members.invite')
    )
  );

commit;
