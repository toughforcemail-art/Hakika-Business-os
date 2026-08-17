import { requireApplicationContext } from "@/lib/platform/context";
import { AdminShell } from "@/components/AdminPage";
import { InviteDirectorForm } from "./InviteDirectorForm";
import { ResendInvitationButton } from "./ResendInvitationButton";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default async function PlatformUserInvitePage() {
  const ctx = await requireApplicationContext("PLATFORM_ADMIN");
  const [{ data: organizations }, { data: invitations }] = await Promise.all([
    ctx.supabase.schema("platform").from("organizations").select("id,display_name,organization_type").eq("status", "active").order("display_name"),
    ctx.supabase.schema("iam").from("invitations").select("id,organization_id,email,phone,status,delivery_channel,delivery_status,expires_at,created_at,accepted_at,accepted_by").order("created_at", { ascending: false }).limit(100),
  ]);
  const organizationMap = new Map((organizations ?? []).map((organization: any) => [organization.id, organization.display_name]));
  return <AdminShell kind="platform"><main className="workspace-main">
    <header className="re-page-header"><div><span className="re-eyebrow">Platform access</span><h1>Invite organization director</h1><p>Assign organization-wide access to subscribed applications without granting platform-superadmin privileges.</p></div></header>
    <InviteDirectorForm organizations={organizations ?? []}/>
    <section className="re-surface re-table-wrap platform-invitation-history">
      <div className="re-section-head"><div><span className="re-eyebrow">Invitation history</span><h2>Previous director invitations</h2><p>Track delivery, expiry and whether each recipient has completed sign-in.</p></div><span className="re-badge">{invitations?.length ?? 0} records</span></div>
      <table className="re-table"><thead><tr><th>Recipient</th><th>Organization</th><th>Delivery</th><th>Invitation</th><th>Signed in</th><th>Created</th></tr></thead><tbody>
        {(invitations ?? []).map((invitation: any) => {
          const signedIn = Boolean(invitation.accepted_at || invitation.status === "accepted");
          const expired = !signedIn && invitation.status === "pending" && new Date(invitation.expires_at).getTime() <= Date.now();
          const invitationStatus = expired ? "Expired" : invitation.status;
          return <tr key={invitation.id}><td><strong>{invitation.email || "Phone invitation"}</strong><small>{invitation.phone || "No phone"}</small></td><td>{organizationMap.get(invitation.organization_id) || invitation.organization_id}</td><td><span className={`re-badge ${invitation.delivery_status === "failed" ? "re-badge-error" : ""}`}>{invitation.delivery_channel || "—"} · {invitation.delivery_status || "pending"}</span></td><td><span className="re-badge">{invitationStatus}</span><small>Expires {formatDate(invitation.expires_at)}</small></td><td>{signedIn ? <><span className="re-badge">Yes</span><small>{formatDate(invitation.accepted_at)}</small></> : <span className="re-muted-status">Not yet</span>}</td><td>{formatDate(invitation.created_at)}<ResendInvitationButton invitationId={invitation.id}/></td></tr>;
        })}
      </tbody></table>
      {!invitations?.length && <div className="re-empty compact"><h3>No invitations yet</h3><p>Invitations created from this page will appear here.</p></div>}
    </section>
  </main></AdminShell>;
}
