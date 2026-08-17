"use client";

import { useActionState } from "react";
import { inviteOrganizationDirector } from "../actions";

export function InviteDirectorForm({ organizations }: { organizations: { id: string; display_name: string; organization_type: string }[] }) {
  const [state, action, pending] = useActionState(inviteOrganizationDirector, null);
  return <form action={action} className="card panel role-form">
    <h2>Secure invitation</h2>
    <p className="context">The recipient creates their own password. No password is generated or sent by Hakika.</p>
    <label>Organization<select name="organization_id" required><option value="">Select organization</option>{organizations.map((organization) => <option value={organization.id} key={organization.id}>{organization.display_name} · {organization.organization_type}</option>)}</select></label>
    <label>Email address<input name="email" type="email" placeholder="director@example.com" /></label>
    <label>Phone number<input name="phone" type="tel" placeholder="+254 7XX XXX XXX" /></label>
    {state?.error && <p className="re-form-error">{state.error}</p>}
    {state?.success && <div className="re-form-success">
      <strong>Invitation created and delivery attempted</strong>
      <p>{state.role} assigned to {state.organization} for {state.applications.join(", ")}.</p>
      {state.delivery && <p className="context">Delivery: {Object.entries(state.delivery).map(([channel, status]) => `${channel} ${status}`).join(" · ") || "not attempted"}</p>}
      {state.deliveryWarning && <p className="re-form-error">{state.deliveryWarning}</p>}
      <label>Secure invitation link<input readOnly value={state.inviteUrl}/></label>
      <small>Expires {new Date(state.expiresAt).toLocaleString()}. Email uses Resend and SMS uses Africa&apos;s Talking.</small>
    </div>}
    <button className="re-button primary" type="submit" disabled={pending}>{pending ? "Creating invitation…" : "Create secure invitation"}</button>
  </form>;
}
