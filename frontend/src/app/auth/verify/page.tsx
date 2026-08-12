import { Suspense } from "react";
import LoginVerificationClient from "@/components/LoginVerificationClient";

export default function LoginVerificationPage() {
  return <Suspense fallback={<main className="auth-page"><section className="auth-panel"><div className="auth-card card">Loading verification…</div></section></main>}><LoginVerificationClient /></Suspense>;
}
