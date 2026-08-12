"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (loading) return; setLoading(true); await createSupabaseBrowserClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/auth/confirm?type=recovery&next=%2Fauth%2Fupdate-password` }); setSent(true); setLoading(false); }
  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Account recovery</div><h1>Forgot your password?</h1>{sent ? <><p className="auth-lede" role="status">If an account matches those details, recovery instructions have been sent.</p><Link className="button primary auth-submit" href="/auth/check-email">Check your email</Link></> : <form onSubmit={submit}><p className="auth-lede">Enter your email address and we’ll send secure recovery instructions.</p><label htmlFor="recovery-email">Email address</label><input id="recovery-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /><button className="button primary auth-submit" type="submit" disabled={loading}>{loading ? "Sending…" : "Send recovery link"}</button></form>}<Link href="/login" className="back-link" style={{ display: "block", marginTop: 20 }}>Back to sign in</Link></div></section></main>;
}
