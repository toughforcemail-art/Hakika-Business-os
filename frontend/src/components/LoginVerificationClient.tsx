"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeAuthDestination } from "@/lib/auth/redirects";

export default function LoginVerificationClient() {
  const router = useRouter();
  const params = useSearchParams();
  const [channel, setChannel] = useState<"email" | "phone">(params.get("channel") === "phone" ? "phone" : "email");
  const next = safeAuthDestination(params.get("next"));
  const [started, setStarted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [, setRequestId] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resends, setResends] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const label = useMemo(() => channel === "phone" ? "your verified phone" : "your verified email address", [channel]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function chooseChannel(nextChannel: "email" | "phone") {
    setChannel(nextChannel);
    setStarted(false);
    setCode("");
    setError("");
    setStatus("");
    setCooldown(0);
  }

  function updateCode(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const nextCode = code.split("");
    nextCode[index] = digit;
    setCode(nextCode.join("").slice(0, 6));
    if (digit) inputRefs.current[index + 1]?.focus();
  }

  function handleCodeKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !code[index] && index > 0) inputRefs.current[index - 1]?.focus();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setCode(pasted);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  }

  async function challenge() {
    setLoading(true); setError("");
    const response = await fetch("/api/auth/login-verification/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
    const result = await response.json().catch(() => ({})) as { error?: string; retryAfter?: number; requestId?: string; code?: string };
    setRequestId(result.requestId ?? "");
    if (!response.ok) {
      if (response.status === 401 || result.code === "SESSION_REQUIRED" || result.code === "SESSION_TOKEN_MISSING") { window.location.assign(`/login?next=${encodeURIComponent(next)}`); return; }
      if (response.status === 429 && result.retryAfter) setCooldown(result.retryAfter);
      const message = response.status === 429 ? `Too many verification requests. Try again in ${result.retryAfter ?? 30} seconds.` : response.status === 403 && channel === "phone" ? "SMS verification is unavailable because this account has no verified phone. Choose Email instead." : result.error ?? "Verification could not be started.";
      setError(result.requestId ? `${message} Reference: ${result.requestId}` : message);
    } else {
      setStarted(true); setStatus(`A six-digit ${channel === "phone" ? "SMS" : "email"} code was sent to ${label}.`); setCooldown(30);
    }
    setLoading(false);
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit verification code."); return; }
    setLoading(true); setError("");
    const response = await fetch("/api/auth/login-verification/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otp: code, channel }) });
    if (response.ok) router.replace(next);
    else {
      const result = await response.json().catch(() => ({})) as { error?: string; requestId?: string; code?: string };
      setRequestId(result.requestId ?? "");
      if (response.status === 401 || result.code === "SESSION_REQUIRED" || result.code === "SESSION_TOKEN_MISSING") { window.location.assign(`/login?next=${encodeURIComponent(next)}`); return; }
      const message = result.code === "CHANNEL_MISMATCH" ? `This code belongs to ${channel === "phone" ? "SMS" : "email"}. Request a new ${channel === "phone" ? "SMS" : "email"} code.` : result.error ?? "Verification could not be completed.";
      setError(result.requestId ? `${message} Reference: ${result.requestId}` : message);
    }
    setLoading(false);
  }

  async function resend() {
    if (!started || cooldown || resends >= 5) return;
    setLoading(true);
    const response = await fetch("/api/auth/login-verification/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
    const result = await response.json().catch(() => ({})) as { error?: string; requestId?: string; retryAfter?: number };
    setRequestId(result.requestId ?? "");
    if (response.ok) { setResends((value) => value + 1); setCooldown(30); setStatus(`A new ${channel === "phone" ? "SMS" : "email"} code was sent.`); }
    else { if (response.status === 429 && result.retryAfter) setCooldown(result.retryAfter); setError(result.error ?? "Verification could not be resent."); }
    setLoading(false);
  }

  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Hakika Login Verification</div><h1>Verify your sign-in</h1><p className="auth-lede">Choose Email or SMS, then enter the code sent through that same channel.</p><div className="auth-tabs" role="tablist" aria-label="Verification method"><button type="button" role="tab" aria-selected={channel === "email"} className={channel === "email" ? "selected" : ""} onClick={() => chooseChannel("email")}>Email</button><button type="button" role="tab" aria-selected={channel === "phone"} className={channel === "phone" ? "selected" : ""} onClick={() => chooseChannel("phone")}>SMS</button></div>{!started ? <button className="button primary auth-submit" type="button" onClick={() => void challenge()} disabled={loading}>{loading ? "Sending…" : `Send ${channel === "phone" ? "SMS" : "email"} code`}</button> : <form onSubmit={verify}><label id="login-code-label">{channel === "phone" ? "SMS" : "Email"} code</label><div className="otp-boxes" role="group" aria-labelledby="login-code-label" onPaste={handlePaste}>{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { inputRefs.current[index] = element; }} className="otp-box" aria-label={`${channel === "phone" ? "SMS" : "Email"} verification digit ${index + 1}`} inputMode="numeric" autoComplete={index === 0 ? "one-time-code" : "off"} maxLength={1} autoFocus={index === 0} value={code[index] ?? ""} onChange={(event) => updateCode(index, event.target.value)} onKeyDown={(event) => handleCodeKeyDown(index, event)} />)}</div><button className="button primary auth-submit" type="submit" disabled={loading}>{loading ? "Verifying…" : "Verify and continue"}</button><button className="text-button auth-submit" type="button" onClick={() => void resend()} disabled={loading || cooldown > 0 || resends >= 5}>{cooldown ? `Resend available in ${cooldown}s` : resends >= 5 ? "Resend limit reached" : `Resend ${channel === "phone" ? "SMS" : "email"} code`}</button></form>}{status && <p className="auth-security" role="status">{status}</p>}{error && <p className="auth-error" role="alert">{error}</p>}<p className="auth-security">Codes expire in 5 minutes and can be used once.</p></div><Link href="/login" className="back-link">Use another account</Link></section></main>;
}
