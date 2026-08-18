import Link from "next/link";
import { requireApplicationContext } from "@/lib/platform/context";

function dateLabel(value: string | null) {
  return value ? new Date(value).toLocaleDateString("en-KE", { dateStyle: "medium" }) : "—";
}

export default async function PlatformAdmin() {
  const ctx = await requireApplicationContext("PLATFORM_ADMIN");
  const [{ count: organizations }, { count: users }, { count: invitations }, { data: organizationRows }, { data: invitationRows }, { data: membershipRows }, { data: profiles }] = await Promise.all([
    ctx.supabase.schema("platform").from("organizations").select("id", { count: "exact", head: true }),
    ctx.supabase.schema("iam").from("organization_memberships").select("id", { count: "exact", head: true }).eq("status", "active"),
    ctx.supabase.schema("iam").from("invitations").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ctx.supabase.schema("platform").from("organizations").select("id,display_name,organization_type,status,created_at").eq("status", "active").order("created_at", { ascending: false }).limit(6),
    ctx.supabase.schema("iam").from("invitations").select("id,organization_id,email,phone,status,delivery_status,created_at,expires_at").order("created_at", { ascending: false }).limit(5),
    ctx.supabase.schema("iam").from("organization_memberships").select("id,user_id,organization_id,status,joined_at").eq("status", "active").order("joined_at", { ascending: false }).limit(5),
    ctx.supabase.schema("iam").from("profiles").select("user_id,display_name,status"),
  ]);
  const organizationMap = new Map((organizationRows ?? []).map((row: any) => [row.id, row]));
  const profileMap = new Map((profiles ?? []).map((row: any) => [row.user_id, row]));
  return <main className="workspace-main">
    <header className="re-page-header"><div><span className="re-eyebrow">Platform administration</span><h1>Platform dashboard</h1><p>Manage organizations, application access, invitations and platform governance.</p></div><div className="re-actions"><Link className="re-button primary" href="/platform/users/new">Invite director</Link><Link className="re-button secondary" href="/platform/provisioning">Provision customer</Link></div></header>
    <div className="re-stats"><div className="re-stat"><span>Organizations</span><strong>{organizations ?? 0}</strong><small>Active workspaces</small></div><div className="re-stat"><span>Users</span><strong>{users ?? 0}</strong><small>Active memberships</small></div><div className="re-stat"><span>Pending invitations</span><strong>{invitations ?? 0}</strong><small>Awaiting sign-in</small></div><div className="re-stat"><span>Access model</span><strong>Scoped</strong><small>Organization-safe access</small></div></div>
    <div className="platform-dashboard-grid">
      <section className="re-surface platform-dashboard-panel"><div className="re-section-head"><div><span className="re-eyebrow">Organizations</span><h2>Customer workspaces</h2><p>Active organizations and their operating context.</p></div><Link href="/platform/organizations">View all</Link></div><div className="re-list">{(organizationRows ?? []).map((organization: any) => <Link className="re-list-row" href={`/platform/organizations/${organization.id}`} key={organization.id}><span><strong>{organization.display_name}</strong><small>{organization.organization_type} · Created {dateLabel(organization.created_at)}</small></span><b>{organization.status}</b></Link>)}{!organizationRows?.length && <div className="re-empty compact"><p>No organizations are available.</p></div>}</div></section>
      <section className="re-surface platform-dashboard-panel"><div className="re-section-head"><div><span className="re-eyebrow">People and access</span><h2>Recent users</h2><p>Who can enter the organization workspaces.</p></div><Link href="/platform/users">View users</Link></div><div className="re-list">{(membershipRows ?? []).map((membership: any) => <Link className="re-list-row" href="/platform/users" key={membership.id}><span><strong>{profileMap.get(membership.user_id)?.display_name || membership.user_id}</strong><small>{organizationMap.get(membership.organization_id)?.display_name || "Organization"}</small></span><b>{profileMap.get(membership.user_id)?.status || "active"}</b></Link>)}{!membershipRows?.length && <div className="re-empty compact"><p>No active users are available.</p></div>}</div></section>
    </div>
    <section className="re-surface platform-dashboard-panel platform-dashboard-invitations"><div className="re-section-head"><div><span className="re-eyebrow">Invitation delivery</span><h2>Recent invitations</h2><p>Monitor delivery and follow up with recipients who have not signed in.</p></div><Link className="re-button secondary" href="/platform/users/new">Manage invitations</Link></div><div className="re-table-wrap"><table className="re-table"><thead><tr><th>Recipient</th><th>Organization</th><th>Delivery</th><th>Status</th><th>Created</th></tr></thead><tbody>{(invitationRows ?? []).map((invitation: any) => <tr key={invitation.id}><td><strong>{invitation.email || "Phone invitation"}</strong><small>{invitation.phone || "No phone"}</small></td><td>{organizationMap.get(invitation.organization_id)?.display_name || invitation.organization_id}</td><td><span className="re-badge">{invitation.delivery_status || "pending"}</span></td><td><span className="re-badge">{invitation.status}</span></td><td>{dateLabel(invitation.created_at)}</td></tr>)}</tbody></table>{!invitationRows?.length && <div className="re-empty compact"><p>No invitations have been created.</p></div>}</div></section>
  </main>;
}
