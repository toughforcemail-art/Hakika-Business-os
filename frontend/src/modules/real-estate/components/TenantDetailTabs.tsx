"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { TenantSwapFlow } from "./TenantSwapFlow";

type Tenant = { id: string; full_name: string; email?: string | null; phone?: string | null; tenant_number?: string | null; national_id?: string | null; status?: string | null; portal_status?: string | null; notes?: string | null; profile_image_url?: string | null };
type Lease = { lease_number?: string | null; property_name?: string | null; unit_number?: string | null; start_date?: string | null; end_date?: string | null; rent_amount_minor?: number | null; status?: string | null } | null;
type Invoice = { id: string; invoice_number?: string | null; billing_month?: string | null; total_minor?: number | null; balance_due_minor?: number | null; status?: string | null };
type Payment = { id: string; payment_reference?: string | null; amount_minor?: number | null; paid_at?: string | null; payment_method?: string | null; status?: string | null };

const money = (minor?: number | null) => `KES ${((minor ?? 0) / 100).toLocaleString()}`;
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function TenantDetailTabs({ tenant, lease, invoices, payments, properties = [], units = [] }: { tenant: Tenant; lease: Lease; invoices: Invoice[]; payments: Payment[]; properties?: { id: string; name: string }[]; units?: { id: string; property_id: string; unit_number: string; status: string; monthly_rent_minor?: number | null }[] }) {
  const [tab, setTab] = useState("Tenant Details");
  const balance = useMemo(() => invoices.reduce((total, invoice) => total + (invoice.balance_due_minor ?? 0), 0), [invoices]);
  const ledger = useMemo(() => [
    ...invoices.map((invoice) => ({ date: invoice.billing_month ?? "—", label: invoice.invoice_number || "Invoice", debit: invoice.total_minor ?? 0, credit: 0, status: invoice.status || "draft" })),
    ...payments.map((payment) => ({ date: payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "—", label: payment.payment_reference || "Payment", debit: 0, credit: payment.amount_minor ?? 0, status: payment.status || "received" })),
  ].sort((a, b) => a.date.localeCompare(b.date)), [invoices, payments]);

  return <section className="re-surface re-tenant-detail">
    <div className="re-detail-tabs">{["Tenant Details", "Messages", "Ledger", "Wallet"].map((name) => <button key={name} className={`re-button ${tab === name ? "primary" : "secondary"}`} onClick={() => setTab(name)}>{name}</button>)}<Link className="re-button secondary" href="/real-estate/tenants">Close</Link></div>

    {tab === "Tenant Details" && <>
      <div className="re-tenant-profile-heading">{tenant.profile_image_url ? <img className="re-tenant-avatar" src={tenant.profile_image_url} alt={`${tenant.full_name} profile`} /> : <div className="re-tenant-avatar">{initials(tenant.full_name)}</div>}<div><h2>{tenant.full_name}</h2><p>{lease?.property_name ? `${lease.property_name} · Unit ${lease.unit_number || "—"}` : "No unit assigned"}</p><span className="re-badge">{tenant.status || "active"}</span></div></div>
      <div className="re-detail-grid re-tenant-info-grid"><section><span className="re-eyebrow">Identity</span><h3>Contact details</h3><dl><dt>Tenant number</dt><dd>{tenant.tenant_number || "Not set"}</dd><dt>Phone</dt><dd>{tenant.phone || "Not set"}</dd><dt>Email</dt><dd>{tenant.email || "Not set"}</dd><dt>National ID</dt><dd>{tenant.national_id || "Not set"}</dd></dl></section><section><span className="re-eyebrow">Lease</span><h3>Property assignment</h3><dl><dt>Property</dt><dd>{lease?.property_name || "Not assigned"}</dd><dt>Unit</dt><dd>{lease?.unit_number || "Not assigned"}</dd><dt>Monthly rent</dt><dd>{lease ? money(lease.rent_amount_minor) : "—"}</dd><dt>Lease dates</dt><dd>{lease ? `${lease.start_date || "—"} to ${lease.end_date || "Open-ended"}` : "No active lease"}</dd></dl></section></div>
      <div className="re-actions"><Link className="re-button primary" href={`/real-estate/tenants/${tenant.id}/edit`}>Edit Tenant</Link><Link className="re-button secondary" href={`/real-estate/tenants/${tenant.id}/portal-access`}>Manage Portal</Link><Link className="re-button secondary" href={`/real-estate/invoices/new?tenant=${tenant.id}`}>Create Invoice</Link><Link className="re-button secondary" href={`/real-estate/payments/new?tenant=${tenant.id}`}>Record Payment</Link><TenantSwapFlow tenantId={tenant.id} currentProperty={lease?.property_name ?? undefined} currentUnit={lease?.unit_number ?? undefined} properties={properties} units={units}/></div>
    </>}

    {tab === "Messages" && <div className="re-tab-empty"><h2>Messages sent to {tenant.full_name}</h2><p>Tenant messages and invoice notifications will appear here when messaging is connected.</p><button className="re-button primary" type="button">Message Tenant</button></div>}

    {tab === "Ledger" && <div className="re-tab-content"><div className="re-section-head"><div><span className="re-eyebrow">Account activity</span><h2>Ledger for {tenant.full_name}</h2></div><button className="re-button secondary" type="button" onClick={() => window.print()}>Print ledger</button></div><div className="re-ledger-summary"><div><span>Outstanding balance</span><strong>{money(balance)}</strong></div><div><span>Invoices</span><strong>{invoices.length}</strong></div><div><span>Payments</span><strong>{payments.length}</strong></div></div><div className="re-table-wrap"><table className="re-table"><thead><tr><th>Date</th><th>Reference</th><th>Debit</th><th>Credit</th><th>Status</th></tr></thead><tbody>{ledger.map((row, index) => <tr key={`${row.label}-${index}`}><td>{row.date}</td><td>{row.label}</td><td>{row.debit ? money(row.debit) : "—"}</td><td>{row.credit ? money(row.credit) : "—"}</td><td><span className="re-badge">{row.status}</span></td></tr>)}</tbody></table>{!ledger.length && <div className="re-empty compact"><p>No ledger activity yet.</p></div>}</div></div>}

    {tab === "Wallet" && <div className="re-tab-content"><div className="re-section-head"><div><span className="re-eyebrow">Tenant wallet</span><h2>Payment transactions</h2></div><Link className="re-button secondary" href={`/real-estate/payments/new?tenant=${tenant.id}`}>Record payment</Link></div><div className="re-table-wrap"><table className="re-table"><thead><tr><th>Reference</th><th>Transaction</th><th>Amount</th><th>Date</th><th>Method</th><th>Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td>{payment.payment_reference || "—"}</td><td>Rent payment</td><td>{money(payment.amount_minor)}</td><td>{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : "—"}</td><td>{payment.payment_method || "—"}</td><td><span className="re-badge">{payment.status || "received"}</span></td></tr>)}</tbody></table>{!payments.length && <div className="re-empty compact"><p>No wallet transactions yet.</p></div>}</div></div>}
  </section>;
}
