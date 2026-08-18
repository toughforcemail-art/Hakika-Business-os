"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const passwordChecks = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
];

export default function AcceptInvitationForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function completeAcceptance(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
    const accepted = await supabase.rpc("accept_invitation", { invitation_token_hash: await sha256(token) });
    if (accepted.error) {
      setError(accepted.error.message.includes("schema cache")
        ? "The invitation service is not enabled yet. Please ask an administrator to apply the latest migration."
        : accepted.error.message.includes("expired")
          ? "This invitation has expired. Ask the sender to resend it; renewed invitations are valid for 48 hours."
          : "We could not finish joining the organization. Please try again or ask the sender to resend the invitation.");
      setStatus("");
      return false;
    }
    window.location.href = "/auth/verify?channel=email&next=%2Fapps";
    return true;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const missing = passwordChecks.filter((check) => !check.test(password)).map((check) => check.label.toLowerCase());
    if (missing.length) {
      setError(`Choose a stronger password. Add ${missing.join(", ")}.`);
      return;
    }
    if (!token) { setError("This invitation link is missing its token."); return; }
    setStatus("Creating your secure account…");
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(token)}`;
    let result = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } });
    if (result.error?.message?.toLowerCase().includes("already registered")) {
      setStatus("Signing in to complete your invitation…");
      result = await supabase.auth.signInWithPassword({ email, password });
    }
    if (result.error) {
      setError(result.error.message.toLowerCase().includes("password")
        ? "Choose a password with at least 8 characters, including lowercase, uppercase, and a number."
        : result.error.message);
      setStatus("");
      return;
    }
    if (!result.data.session) {
      setStatus("Account created. Confirm your email, then return here to finish joining the organization.");
      return;
    }
    await completeAcceptance(supabase);
  }

  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Organization invitation</div><h1>Set up your access</h1><p className="auth-lede">Create your own password to join the assigned organization applications. Hakika never sends passwords by email or SMS.</p><form onSubmit={submit}><label htmlFor="invite-email">Email address</label><input id="invite-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"/><label htmlFor="invite-password">Password</label><div className="password-field"><input id="invite-password" type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={(event) => { setPassword(event.target.value); if (error) setError(""); }} autoComplete="new-password" aria-describedby="password-rules"/><button type="button" className="password-toggle" aria-pressed={showPassword} aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Hide password" : "Show password"}</button></div><ul id="password-rules" className="password-rules" aria-label="Password requirements">{passwordChecks.map((check) => <li className={check.test(password) ? "valid" : ""} key={check.label}>{check.test(password) ? "✓" : "○"} {check.label}</li>)}</ul><label className="password-visibility"><input type="checkbox" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)}/> Show password while typing</label><button className="button primary auth-submit" type="submit">Create account</button></form>{status && <p role="status">{status}</p>}{error && <p className="auth-error" role="alert">{error}</p>}<p className="auth-security">After account setup, the normal login verification and SMS step-up flow remains active.</p></div><Link href="/login" className="back-link">Already have an account? Sign in</Link></section></main>;
}
