import Link from "next/link";
import { ReButton, ReHeader, StatCard } from "@/modules/real-estate/components/Shell";
import { listScopedTenants } from "@/modules/real-estate/tenant-billing";
import { getRealEstateTenantContext } from "@/modules/real-estate/services/tenant-context";

export default async function Tenants({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  const ctx = await getRealEstateTenantContext();
  const [result, leaseResult, propertyResult, unitResult] = await Promise.all([
    listScopedTenants(p.q ?? ""),
    ctx.supabase.schema("real_estate").from("leases").select("tenant_id,property_id,unit_id,rent_amount_minor,end_date").eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null),
    ctx.supabase.schema("real_estate").from("properties").select("id,name").eq("organization_id", ctx.organizationId).is("archived_at", null),
    ctx.supabase.schema("real_estate").from("units").select("id,unit_number").eq("organization_id", ctx.organizationId).is("archived_at", null),
  ]);
  if (result.error) throw new Error(`Could not load tenants: ${result.error.message}`);
  if (leaseResult.error) throw new Error(`Could not load tenant assignments: ${leaseResult.error.message}`);
  if (propertyResult.error) throw new Error(`Could not load tenant properties: ${propertyResult.error.message}`);
  if (unitResult.error) throw new Error(`Could not load tenant units: ${unitResult.error.message}`);
  const propertyNames = new Map((propertyResult.data ?? []).map((property: any) => [property.id, property.name]));
  const unitNumbers = new Map((unitResult.data ?? []).map((unit: any) => [unit.id, unit.unit_number]));
  const assignments = new Map<string, any>((leaseResult.data ?? []).map((lease: any) => [lease.tenant_id, { ...lease, property_name: propertyNames.get(lease.property_id), unit_number: unitNumbers.get(lease.unit_id) }]));
  const rows = ((result.data ?? []) as any[]).map((tenant) => ({ ...tenant, assignment: assignments.get(tenant.id) }));
  const properties = [...new Set(rows.map((row) => row.assignment?.property_name).filter(Boolean))];
  const units = [...new Set(rows.map((row) => row.assignment?.unit_number).filter(Boolean))];
  const statuses = [...new Set(rows.map((row) => row.status).filter(Boolean))];
  const filtered = rows.filter((row) => (!p.property || row.assignment?.property_name === p.property) && (!p.unit || row.assignment?.unit_number === p.unit) && (!p.status || row.status === p.status));
  return <main className="re-main">
    <ReHeader eyebrow="Tenant management" title="Tenant Management" description="Manage tenants, leases, deposits, portal access and unit allocations." actions={<ReButton href="/real-estate/tenants/new">Onboard New Tenant</ReButton>} />
    <div className="re-stats"><StatCard label="Total tenants" value={result.count ?? rows.length} note="Active records" /><StatCard label="Shown" value={filtered.length} note="Current filters" /><StatCard label="With leases" value={rows.filter((row) => row.assignment).length} note="Assigned units" /><StatCard label="Outstanding balance" value="—" note="From issued invoices" /></div>
    <section className="re-surface re-tenant-toolbar"><div className="re-section-head"><div><span className="re-eyebrow">Tenant directory</span><h2>Filter tenants</h2><p>Search by person, then narrow the list by property, unit or status.</p></div><span className="re-badge">{filtered.length} shown</span></div><form className="re-tenant-filter-grid"><label className="re-field"><span>Search</span><input name="q" defaultValue={p.q} placeholder="Name, phone, email or ID" /></label><label className="re-field"><span>Property</span><select name="property" defaultValue={p.property ?? ""}><option value="">All properties</option>{properties.map((value) => <option key={value}>{value}</option>)}</select></label><label className="re-field"><span>Unit</span><select name="unit" defaultValue={p.unit ?? ""}><option value="">All units</option>{units.map((value) => <option key={value}>{value}</option>)}</select></label><label className="re-field"><span>Status</span><select name="status" defaultValue={p.status ?? ""}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><div className="re-actions"><button className="re-button secondary">Apply filters</button><Link className="re-button secondary" href="/real-estate/tenants">Clear filters</Link></div></form></section>
    <section className="re-surface re-table-wrap"><div className="re-section-head"><span className="re-eyebrow">Tenant records</span></div><table className="re-table"><thead><tr><th>Tenant</th><th>Contact</th><th>Property / Unit</th><th>Lease</th><th>Portal</th><th>Actions</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><Link href={`/real-estate/tenants/${row.id}`}><strong>{row.full_name}</strong><small>{row.tenant_number || row.id}</small></Link></td><td>{row.phone || "—"}<br /><small>{row.email || "No email"}</small></td><td>{row.assignment?.property_name || "Not assigned"}<br /><small>{row.assignment?.unit_number ? `${row.assignment.unit_number} · ${row.assignment.rent_amount_minor ? `KES ${(row.assignment.rent_amount_minor / 100).toLocaleString()}` : "Rent not set"}` : "No active unit"}</small></td><td><span className="re-badge">{row.assignment ? "Active" : "Unassigned"}</span><br /><small>{row.assignment?.end_date ? `Ends ${row.assignment.end_date}` : "—"}</small></td><td>{row.portal_status || "Not invited"}</td><td><Link className="re-row-action" href={`/real-estate/tenants/${row.id}`}>Open profile</Link><br /><Link className="re-row-action" href={`/real-estate/tenants/${row.id}/edit`}>Edit</Link></td></tr>)}</tbody></table>{!filtered.length && <div className="re-empty"><h3>No tenants found</h3><p>Adjust the filters or onboard a new tenant.</p><ReButton href="/real-estate/tenants/new">Onboard New Tenant</ReButton></div>}</section>
  </main>;
}
