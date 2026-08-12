"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

const applications = ["REAL_ESTATE", "HR", "FINANCE", "TOUGHFORCE"];

export default function ProvisioningPage() {
  const [organizationName, setOrganizationName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selected, setSelected] = useState<string[]>(["REAL_ESTATE"]);
  const [status, setStatus] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("Provisioning…");
    const response = await fetch("/api/platform/provision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ organizationName, companyName, applicationKeys: selected, requestKey: crypto.randomUUID() }) });
    const result = await response.json(); setStatus(response.ok ? `Provisioned organization ${result.organization_id}.` : (result.error ?? "Provisioning failed."));
  }
  return <main className="public-main" style={{ maxWidth: 720 }}><Link href="/platform/dashboard" className="back-link">← Platform dashboard</Link><div className="eyebrow" style={{ marginTop: 28 }}>Platform Administration</div><h1>Provision a customer workspace.</h1><p className="section-intro">Create the organization, first company, Customer Admin access and selected application subscriptions in one audited transaction.</p><form className="card panel" onSubmit={submit}><label className="kpi-label" htmlFor="organization">Organization name</label><input id="organization" required value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} style={{ width: "100%", padding: 12, margin: "7px 0 16px" }} /><label className="kpi-label" htmlFor="company">First company</label><input id="company" required value={companyName} onChange={(event) => setCompanyName(event.target.value)} style={{ width: "100%", padding: 12, margin: "7px 0 16px" }} /><fieldset style={{ border: 0, padding: 0 }}><legend className="kpi-label">Applications</legend>{applications.map((application) => <label key={application} style={{ display: "block", margin: "10px 0" }}><input type="checkbox" checked={selected.includes(application)} onChange={(event) => setSelected((current) => event.target.checked ? [...new Set([...current, application])] : current.filter((value) => value !== application))} /> {application}</label>)}</fieldset>{status && <p role="status">{status}</p>}<button className="button" type="submit" disabled={!selected.length}>Provision workspace</button></form></main>;
}
