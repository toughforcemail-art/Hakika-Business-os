"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { safeAuthDestination } from "@/lib/auth/redirects";

export default function HakikaStepUpVerification() {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [started, setStarted] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resends, setResends] = useState(0);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function chooseChannel(nextChannel: "email" | "phone") {
    setChannel(nextChannel); setStarted(false); setCode(""); setError(""); setStatus(""); setCooldown(0);
  }
  function setDigit(index: number, value: string) { const digit = value.replace(/\D/g, "").slice(-1); const nextCode = code.split(""); nextCode[index] = digit; setCode(nextCode.join("").slice(0, 6)); if (digit) refs.current[index + 1]?.focus(); }
  function keyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) { if (event.key === "Backspace" && !code[index] && index > 0) refs.current[index - 1]?.focus(); }
  function paste(event: React.ClipboardEvent<HTMLInputElement>) { event.preventDefault(); const value = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6); setCode(value); refs.current[Math.min(value.length, 5)]?.focus(); }

  async function start() {
    setLoading(true); setError("");
    const response = await fetch("/api/auth/sms-challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
    const result = await response.json().catch(() => ({})) as { error?: string; retryAfter?: number; code?: string };
    if (!response.ok) { if (response.status === 429 && result.retryAfter) setCooldown(result.retryAfter); setError(response.status === 429 ? `Too many verification requests. Try again in ${result.retryAfter ?? 30} seconds.` : result.error ?? "Verification could not be started."); }
    else { setStarted(true); setCode(""); setCooldown(30); setStatus(`A verification code was sent by ${channel === "email" ? "email" : "SMS"}.`); }
    setLoading(false);
  }

  async function verify(event: FormEvent) {
    event.preventDefault(); if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit verification code."); return; }
    setLoading(true); setError("");
    const response = await fetch("/api/auth/sms-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ otp: code, channel }) });
    if (response.ok) router.replace(safeAuthDestination(new URLSearchParams(window.location.search).get("next"), "/platform/dashboard"));
    else { const result = await response.json().catch(() => ({})) as { error?: string; code?: string }; setError(result.code === "CHANNEL_MISMATCH" ? `This code belongs to ${channel === "email" ? "SMS" : "email"}. Request a new ${channel === "email" ? "email" : "SMS"} code.` : result.error ?? "Verification could not be completed."); }
    setLoading(false);
  }

  async function resend() {
    if (!started || cooldown || resends >= 5) return;
    setLoading(true); const response = await fetch("/api/auth/sms-resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
    if (response.ok) { setResends((value) => value + 1); setCooldown(30); setStatus(`A new ${channel === "email" ? "email" : "SMS"} code was sent.`); } else setError("Verification could not be resent."); setLoading(false);
  }

  const method = channel === "email" ? "Email" : "SMS";
  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Hakika verification</div><h1>Confirm this step-up</h1><p className="auth-lede">Choose Email or SMS. The code and verification method must match.</p><div className="auth-tabs" role="tablist" aria-label="Verification method"><button type="button" role="tab" aria-selected={channel === "email"} className={channel === "email" ? "selected" : ""} onClick={() => chooseChannel("email")}>Email</button><button type="button" role="tab" aria-selected={channel === "phone"} className={channel === "phone" ? "selected" : ""} onClick={() => chooseChannel("phone")}>SMS</button></div>{!started ? <button className="button primary auth-submit" type="button" onClick={() => void start()} disabled={loading}>{loading ? "Sending…" : `Send ${method} code`}</button> : <form onSubmit={verify}><label id="step-code-label">{method} code</label><div className="otp-boxes" role="group" aria-labelledby="step-code-label" onPaste={paste}>{Array.from({ length: 6 }, (_, index) => <input key={index} ref={(element) => { refs.current[index] = element; }} className="otp-box" aria-label={`${method} verification digit ${index + 1}`} inputMode="numeric" maxLength={1} autoFocus={index === 0} value={code[index] ?? ""} onChange={(event) => setDigit(index, event.target.value)} onKeyDown={(event) => keyDown(index, event)} />)}</div><button className="button primary auth-submit" type="submit" disabled={loading}>{loading ? "Checking…" : "Verify and continue"}</button><button className="text-button auth-submit" type="button" onClick={() => void resend()} disabled={loading || cooldown > 0 || resends >= 5}>{cooldown ? `Resend available in ${cooldown}s` : resends >= 5 ? "Resend limit reached" : `Resend ${method} code`}</button></form>}{status && <p className="auth-security" role="status">{status}</p>}{error && <p className="auth-error" role="alert">{error}</p>}<p className="auth-security">Codes expire in 5 minutes and can be used once.</p></div><Link href="/apps" className="back-link">← Back to applications</Link></section></main>;
}
