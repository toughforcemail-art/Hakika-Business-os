"use client";

import { useActionState } from "react";
import { resendOrganizationInvitation } from "../actions";

export function ResendInvitationButton({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(resendOrganizationInvitation, null);
  return <span className="platform-invitation-resend"><form action={action}><input type="hidden" name="invitation_id" value={invitationId}/><button className="re-row-action" type="submit" disabled={pending}>{pending ? "Sending…" : "Resend"}</button></form>{state?.error && <><small className="re-form-error" role="alert">{state.error}</small>{state.inviteUrl && <a className="re-invite-fallback" href={state.inviteUrl}>Copy/open new invite link</a>}</>}{state?.success && <small className="re-delivery-success" role="status">Sent again</small>}</span>;
}
