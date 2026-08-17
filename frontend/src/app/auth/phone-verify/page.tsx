"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { safeAuthDestination } from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function PhoneVerifyPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [next, setNext] = useState("/apps");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(30);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => {
    setPhone(window.sessionStorage.getItem("hakika_phone_login"));
    setNext(safeAuthDestination(new URLSearchParams(window.location.search).get("next")));
  }, []);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function setDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const digits = code.split("");
    digits[index] = digit;
    setCode(digits.join("").slice(0, 6));
    if (digit) refs.current[index + 1]?.focus();
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!phone) { setError("Your phone sign-in session has expired. Return to login and try again."); return; }
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit SMS code."); return; }
    setLoading(true); setError("");
    const result = await createSupabaseBrowserClient().auth.verifyOtp({ phone, token: code, type: "sms" });
    if (result.error || !result.data.session) setError("That SMS code is invalid or expired. Request a new code and try again.");
    else { window.sessionStorage.removeItem("hakika_phone_login"); router.replace(`/auth/verify?channel=phone&next=${encodeURIComponent(next)}`); }
    setLoading(false);
  }

  async function resend() {
    if (!phone || cooldown || resending) return;
    setResending(true); setError("");
    const result = await createSupabaseBrowserClient().auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    if (result.error) setError("We could not resend the SMS code. Check your phone verification and try again.");
    else setCooldown(30);
    setResending(false);
  }

  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">SMS sign-in</div><h1>Enter your code</h1><p className="auth-lede">We sent a six-digit code to your verified phone. Codes expire shortly and can only be used once.</p><form onSubmit={verify}><label htmlFor="phone-code">SMS code</label><div className="otp-boxes" role="group" aria-label="SMS code">{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} className="otp-box" id={index === 0 ? "phone-code" : undefined} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} value={code[index] ?? ""} onChange={(event) => setDigit(index, event.target.value)} />)}</div><button className="button primary auth-submit" disabled={loading}>{loading ? "Checking code…" : "Verify and continue"}</button><button type="button" className="text-button auth-submit" onClick={() => void resend()} disabled={resending || cooldown > 0}>{cooldown ? `Resend available in ${cooldown}s` : "Resend code"}</button></form>{error && <p className="auth-error" role="alert">{error}</p>}<p className="auth-security">After SMS sign-in, Hakika’s normal organization verification still applies.</p></div><Link href="/login" className="back-link">← Use another sign-in method</Link></section></main>;
}
