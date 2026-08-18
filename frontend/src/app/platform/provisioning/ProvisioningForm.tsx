"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

type Application = { application_key: string; name: string; description: string | null };
type Result = { organization_id?: string; company_id?: string; invitation_id?: string; invite_url?: string; director_role?: string; delivery?: Record<string, unknown> };

const defaults = ["REAL_ESTATE", "HR", "FINANCE", "TOUGHFORCE"];
const labels: Record<string, string> = { REAL_ESTATE: "Real Estate", HR: "HR", FINANCE: "Finance", TOUGHFORCE: "ToughForce" };

export function ProvisioningForm({ applications }: { applications: Application[] }) {
  const available = useMemo(() => applications.length ? applications : defaults.map((application_key) => ({ application_key, name: labels[application_key], description: null })), [applications]);
  const [selected, setSelected] = useState(defaults.filter((key) => available.some((app) => app.application_key === key)));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorPhone, setDirectorPhone] = useState("");
  const [trialDays, setTrialDays] = useState("14");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setResult(null); setCopied(false);
    try {
      const response = await fetch("/api/platform/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName, organizationSlug: organizationSlug || null, companyName, companyCode: companyCode || null, directorEmail: directorEmail || null, directorPhone: directorPhone || null, applicationKeys: selected, trialDays: Number(trialDays), siteUrl: window.location.origin, requestKey: crypto.randomUUID() }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Workspace provisioning failed.");
      setResult(payload);
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "Workspace provisioning failed."); } finally { setPending(false); }
  }

  async function copyLink() { if (!result?.invite_url) return; await navigator.clipboard.writeText(result.invite_url); setCopied(true); }
  function toggle(key: string) { setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]); }

  return <form className="provisioning-layout" onSubmit={submit}>
    <section className="re-surface provisioning-form-card"><div className="re-section-head"><div><span className="re-eyebrow">Step 1</span><h2>Customer workspace</h2><p>These records become the organization’s operating boundary.</p></div><span className="re-badge">Required</span></div>
      <div className="provisioning-fields"><label>Organization name<input value={organizationName} onChange={(e) => { setOrganizationName(e.target.value); if (!organizationSlug) setOrganizationSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} placeholder="Sunrise Rentals Group" required /></label><label>Organization slug<input value={organizationSlug} onChange={(e) => setOrganizationSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} placeholder="sunrise-rentals" /></label><label>First company<input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Sunrise Property Management" required /></label><label>Company code<input value={companyCode} onChange={(e) => setCompanyCode(e.target.value.toUpperCase().slice(0, 12))} placeholder="SUNRISE" /></label></div>
      <div className="provisioning-callout"><strong>Organization and company scope</strong><span>All records created for this customer remain isolated from other organizations. Additional companies can be added later.</span></div>
    </section>
    <section className="re-surface provisioning-form-card"><div className="re-section-head"><div><span className="re-eyebrow">Step 2</span><h2>Applications and plan</h2><p>Choose the applications this customer can start with.</p></div></div><div className="application-choice-grid">{available.map((application) => <label className={`application-choice ${selected.includes(application.application_key) ? "selected" : ""}`} key={application.application_key}><input type="checkbox" checked={selected.includes(application.application_key)} onChange={() => toggle(application.application_key)} /><span><strong>{application.name || labels[application.application_key]}</strong><small>{application.description || "Organization-scoped business operations"}</small></span><b>{selected.includes(application.application_key) ? "Included" : "Add"}</b></label>)}</div><div className="provisioning-fields compact"><label>Trial days<input type="number" min="0" max="90" value={trialDays} onChange={(e) => setTrialDays(e.target.value)} /></label><div className="provisioning-system-note"><strong>System access</strong><span>Customer Admin is provisioned automatically. Platform Admin is never granted to the customer.</span></div></div></section>
    <section className="re-surface provisioning-form-card"><div className="re-section-head"><div><span className="re-eyebrow">Step 3</span><h2>Invite the Director</h2><p>The Director creates their own password from a one-time, expiring link.</p></div><span className="re-badge">Director</span></div><div className="provisioning-fields"><label>Email address<input type="email" value={directorEmail} onChange={(e) => setDirectorEmail(e.target.value)} placeholder="director@customer.co.ke" /></label><label>Phone number<input type="tel" value={directorPhone} onChange={(e) => setDirectorPhone(e.target.value)} placeholder="+254 7XX XXX XXX" /></label></div><div className="role-definition"><strong>Director · organization scope</strong><span>Receives access to the selected applications. The role can later be edited, restricted, or replaced under Customer Admin → Roles. No password is sent by email or SMS.</span></div>{error && <p className="re-form-error" role="alert">{error}</p>}{result && <div className="provisioning-success" role="status"><strong>Workspace and Director invitation created</strong><span>Organization: {result.organization_id}</span><span>Company: {result.company_id}</span><span>Role: {result.director_role || "Director"}</span><span>Delivery: {result.delivery ? Object.entries(result.delivery).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") : "Attempted"}</span>{result.invite_url && <div className="invite-link-row"><input readOnly value={result.invite_url} aria-label="Secure invitation link"/><button type="button" className="re-button secondary" onClick={() => void copyLink()}>{copied ? "Copied" : "Copy link"}</button></div>}<Link className="re-button secondary" href="/platform/users/new">View invitations</Link></div>}<button className="re-button primary provisioning-submit" type="submit" disabled={pending || !selected.length || (!directorEmail && !directorPhone)}>{pending ? "Provisioning workspace…" : "Create workspace and send invitation"}</button></section>
    <aside className="provisioning-rail"><div className="provisioning-path"><span className="re-eyebrow">Provisioning path</span><ol><li><b>1</b><span><strong>Workspace</strong><small>Organization and first company</small></span></li><li><b>2</b><span><strong>Access</strong><small>Applications and trial</small></span></li><li><b>3</b><span><strong>Invitation</strong><small>Director role and secure link</small></span></li><li><b>4</b><span><strong>Ready</strong><small>Customer sets their password</small></span></li></ol></div><div className="provisioning-security"><strong>Security boundary</strong><p>This operation requires Platform Admin step-up verification. It never creates a platform-superadmin account for the customer.</p></div></aside>
  </form>;
}
