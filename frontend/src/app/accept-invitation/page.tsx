import { Suspense } from "react";
import AcceptInvitationForm from "./AcceptInvitationForm";

export default function AcceptInvitationPage() {
  return <Suspense fallback={<main className="auth-page"><section className="auth-panel"><div className="auth-card card"><p>Loading invitation…</p></div></section></main>}><AcceptInvitationForm /></Suspense>;
}
