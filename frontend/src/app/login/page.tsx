"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { normalizePhoneForCountry, isEmailIdentifier } from "@/lib/auth/phone";
import { safeAuthDestination } from "@/lib/auth/redirects";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { CountryCode } from "libphonenumber-js";

const genericError = "The email/phone number or password is incorrect.";
const countries: { code: CountryCode; name: string; dial: string; flag: string }[] = [
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { code: "UG", name: "Uganda", dial: "+256", flag: "🇺🇬" },
  { code: "TZ", name: "Tanzania", dial: "+255", flag: "🇹🇿" },
  { code: "RW", name: "Rwanda", dial: "+250", flag: "🇷🇼" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
];

export default function Login() {
  const router = useRouter();
  const pathname = usePathname();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState<CountryCode>("KE");
  const [countrySearch, setCountrySearch] = useState("Kenya");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const selectedCountry = countries.find((item) => item.code === country) ?? countries[0];
  const filteredCountries = useMemo(() => countries.filter((item) => `${item.name} ${item.dial}`.toLowerCase().includes(countrySearch.toLowerCase())), [countrySearch]);
  useEffect(() => { setShowPassword(false); }, [pathname, mode]);

  function chooseCountry(value: string) {
    const match = countries.find((item) => `${item.name} ${item.dial}`.toLowerCase() === value.toLowerCase()) ?? countries.find((item) => item.name.toLowerCase() === value.toLowerCase());
    if (match) { setCountry(match.code); setCountrySearch(`${match.name} ${match.dial}`); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    const value = identifier.trim();
    const email = mode === "email" && isEmailIdentifier(value) ? value : undefined;
    const phone = mode === "phone" ? normalizePhoneForCountry(value, country) : undefined;
    if (!email && !phone) { setError(mode === "phone" ? `Enter a valid ${selectedCountry.name} phone number.` : "Enter a valid email address."); return; }
    if (mode === "email" && !password) { setError(genericError); return; }
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    if (mode === "phone") {
      const result = await supabase.auth.signInWithOtp({ phone: phone!, options: { shouldCreateUser: false } });
      if (result.error) {
        setError(result.error.code === "phone_provider_disabled" ? "SMS sign-in is not enabled for this project yet. Enable Auth → Providers → Phone and connect the Hakika Send SMS Hook in Supabase, then try again." : "We could not send an SMS code. Check that this phone is verified and try again.");
        setLoading(false);
        return;
      }
      window.sessionStorage.setItem("hakika_phone_login", phone!);
      router.replace(`/auth/phone-verify?next=${encodeURIComponent(safeAuthDestination(new URLSearchParams(window.location.search).get("next")))}`);
      return;
    }
    const result = await supabase.auth.signInWithPassword({ email: email!, password });
    if (result.error || !result.data.session || !result.data.user) { setShowPassword(false); setError(genericError); setLoading(false); return; }
    const destination = safeAuthDestination(new URLSearchParams(window.location.search).get("next"));
    router.replace(`/auth/verify?channel=email&next=${encodeURIComponent(destination)}`);
  }

  return <main className="auth-page"><section className="auth-panel"><Link href="/" className="wordmark">hakika<span>.</span></Link><div className="auth-card card"><div className="eyebrow">Secure workspace access</div><h1>Welcome back</h1><p className="auth-lede">Sign in once to access the applications your organization has assigned.</p><div className="auth-tabs" role="tablist" aria-label="Sign-in method"><button type="button" role="tab" aria-selected={mode === "email"} className={mode === "email" ? "selected" : ""} onClick={() => { setMode("email"); setError(""); }}>Email</button><button type="button" role="tab" aria-selected={mode === "phone"} className={mode === "phone" ? "selected" : ""} onClick={() => { setMode("phone"); setError(""); }}>Phone</button></div><form onSubmit={submit} noValidate><label htmlFor="identifier">{mode === "email" ? "Email address" : "Mobile number"}</label>{mode === "phone" && <div className="country-row"><input aria-label="Search country" list="country-options" value={countrySearch} onChange={(event) => { setCountrySearch(event.target.value); chooseCountry(event.target.value); }} placeholder="Search country" /><span className="dial-code">{selectedCountry.flag} {selectedCountry.dial}</span><datalist id="country-options">{filteredCountries.map((item) => <option key={item.code} value={`${item.name} ${item.dial}`} />)}</datalist></div>}<input id="identifier" name="identifier" autoComplete={mode === "email" ? "username" : "tel"} inputMode={mode === "email" ? "email" : "tel"} value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={mode === "email" ? "you@company.com" : "0712 345 678"} />{mode === "phone" ? <p className="field-hint">We’ll send a one-time SMS code. No password is required.</p> : <><label htmlFor="password">Password</label><div className="password-row"><input id="password" name="password" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))} onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))} /><button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? "Hide" : "Show"}</button></div>{capsLock && <p className="field-hint" role="status">Caps Lock is on</p>}</>}{error && <p className="auth-error" role="alert">{error}</p>}<button className="button primary auth-submit" type="submit" disabled={loading}>{loading ? "Signing you in…" : mode === "phone" ? "Send SMS code" : "Continue"}</button></form><div className="auth-links"><Link href="/auth/forgot-password">Forgot password?</Link><Link href="/support">Need help?</Link></div><p className="auth-security">Your session is protected by Supabase Auth and organization-level access controls.</p></div><Link href="/" className="back-link">← Back to home</Link></section></main>;
}
