import Link from "next/link";
import { requireApplicationContext } from "@/lib/platform/context";

export default async function PlatformUsersPage() {
  const ctx = await requireApplicationContext("PLATFORM_ADMIN");
  const [{ data: memberships }, { data: organizations }, { data: profiles }, { data: directoryUsers }, { data: assignments }, { data: roles }, { data: applications }] = await Promise.all([
    ctx.supabase.schema("iam").from("organization_memberships").select("id,user_id,organization_id,status,joined_at").order("created_at", { ascending: false }),
    ctx.supabase.schema("platform").from("organizations").select("id,display_name,organization_type"),
    ctx.supabase.schema("iam").from("profiles").select("user_id,display_name,phone_e164,status"),
    ctx.supabase.schema("platform").rpc("list_user_directory"),
    ctx.supabase.schema("iam").from("member_app_roles").select("organization_membership_id,application_id,role_id,company_id,valid_from,valid_until"),
    ctx.supabase.schema("iam").from("roles").select("id,name,role_key,scope"),
    ctx.supabase.schema("platform").from("applications").select("id,application_key,name"),
  ]);

  const orgMap = new Map((organizations ?? []).map((row: any) => [row.id, row]));
  const profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row]));
  const directoryMap = new Map((directoryUsers ?? []).map((row: any) => [row.membership_id, row]));
  const roleMap = new Map((roles ?? []).map((row: any) => [row.id, row]));
  const appMap = new Map((applications ?? []).map((row: any) => [row.id, row]));
  const rows = (memberships ?? []).map((membership: any) => ({
    membership,
    organization: orgMap.get(membership.organization_id),
    profile: profileMap.get(membership.user_id),
    directory: directoryMap.get(membership.id),
    assignments: (assignments ?? []).filter((assignment: any) => assignment.organization_membership_id === membership.id),
  }));

  return <main className="workspace-main"><header className="re-page-header"><div><span className="re-eyebrow">Platform access</span><h1>Users</h1><p>Review organization memberships, application assignments, roles and login status.</p></div><Link className="re-button primary" href="/platform/users/new">Invite organization director</Link></header><section className="re-surface re-table-wrap"><table className="re-table"><thead><tr><th>User</th><th>Organization</th><th>Organization type</th><th>Applications / roles</th><th>Membership</th><th>Profile / phone</th></tr></thead><tbody>{rows.map((row: any) => { const name = row.directory?.display_name || row.profile?.display_name || "Unnamed user"; const email = row.directory?.email || "No email"; return <tr key={row.membership.id}><td><strong>{name}</strong><small>{email}</small></td><td>{row.organization?.display_name || "Unknown organization"}</td><td><span className="re-badge">{row.organization?.organization_type || "—"}</span></td><td>{row.assignments.length ? row.assignments.map((assignment: any) => <div key={`${assignment.application_id}-${assignment.role_id}`}><strong>{appMap.get(assignment.application_id)?.name || assignment.application_id}</strong><small> · {roleMap.get(assignment.role_id)?.name || roleMap.get(assignment.role_id)?.role_key || assignment.role_id}</small></div>) : <span>Not assigned</span>}</td><td><span className="re-badge">{row.membership.status}</span></td><td>{row.directory?.profile_status || row.profile?.status || "No profile"}<br/><small>{row.directory?.phone_e164 || row.profile?.phone_e164 || "No phone"}</small></td></tr>; })}</tbody></table>{!rows.length && <div className="re-empty"><h2>No organization users</h2><p>Invite a Director to create the first organization-scoped user.</p></div>}</section></main>;
}
