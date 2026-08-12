"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeAuthDestination } from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const allowedTypes = new Set<EmailOtpType>(["recovery", "invite", "signup", "email_change", "magiclink"]);

export default function ConfirmAuthLink() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => { void (async () => { const params = new URLSearchParams(window.location.search); const supabase = createSupabaseBrowserClient(); const type = params.get("type") as EmailOtpType | null; const tokenHash = params.get("token_hash"); const code = params.get("code"); let result; if (tokenHash && type && allowedTypes.has(type)) result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }); else if (code) result = await supabase.auth.exchangeCodeForSession(code); else { setError("This confirmation link is missing required information."); return; } if (result.error) { setError("This confirmation link is invalid or expired. Request a new one."); return; } router.replace(type === "recovery" ? "/auth/update-password" : safeAuthDestination(params.get("next"))); })(); }, [router]);
  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Secure confirmation</div><h1>{error ? "Link unavailable" : "Confirming your link…"}</h1>{error ? <><p className="auth-error" role="alert">{error}</p><Link className="button primary auth-submit" href="/auth/forgot-password">Request a new link</Link></> : <p className="auth-lede" role="status">Please wait while we verify this secure link.</p>}</div></section></main>;
}
