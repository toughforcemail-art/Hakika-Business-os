import { getAuthenticatedTenant } from "@/modules/real-estate/tenant-billing";
import { getScopedTenant } from "@/modules/real-estate/tenant-billing";
import { requireApplicationContext } from "@/lib/platform/context";

function pdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, "?");
}

function makePdf(lines: string[]) {
  const content = ["BT", "/F1 18 Tf", "50 760 Td", `(${pdfText(lines[0])}) Tj`, "/F1 11 Tf", ...lines.slice(1).flatMap((line) => [`0 -22 Td`, `(${pdfText(line)}) Tj`]), "ET"].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf, "utf8")); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(pdf, "utf8"));
}

export async function GET(request: Request) {
  const previewTenantId = new URL(request.url).searchParams.get("tenantId");
  const { ctx, tenant } = previewTenantId ? { ctx: await requireApplicationContext("REAL_ESTATE"), tenant: (await getScopedTenant(previewTenantId)).data } : await getAuthenticatedTenant();
  if (!tenant) return new Response("Tenant portal is not linked to a tenant record.", { status: 404 });
  const { data: lease } = await ctx.supabase.schema("real_estate").from("leases").select("lease_number,start_date,end_date,rent_amount_minor,property_id,unit_id,status").eq("tenant_id", tenant.id).eq("organization_id", ctx.organizationId).eq("status", "active").is("archived_at", null).maybeSingle();
  if (!lease) return new Response("No active lease is available for this tenant.", { status: 404 });
  const [{ data: property }, { data: unit }] = await Promise.all([
    ctx.supabase.schema("real_estate").from("properties").select("name,address_line1,city").eq("id", lease.property_id).maybeSingle(),
    ctx.supabase.schema("real_estate").from("units").select("unit_number").eq("id", lease.unit_id).maybeSingle(),
  ]);
  const lines = [
    "HAKIKA REAL ESTATE - TENANCY LEASE SUMMARY",
    `Tenant: ${tenant.full_name}`,
    `Tenant number: ${tenant.tenant_number || "Not set"}`,
    `Property: ${property?.name || "Not set"}`,
    `Address: ${[property?.address_line1, property?.city].filter(Boolean).join(", ") || "Not set"}`,
    `Unit: ${unit?.unit_number || "Not set"}`,
    `Lease number: ${lease.lease_number}`,
    `Lease period: ${lease.start_date} to ${lease.end_date || "Open-ended"}`,
    `Monthly rent: KES ${(Number(lease.rent_amount_minor || 0) / 100).toLocaleString()}`,
    `Status: ${lease.status}`,
    "",
    "This document is generated from the active lease record in Hakika Business OS.",
  ];
  return new Response(makePdf(lines), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="lease-${tenant.tenant_number || tenant.id}.pdf"`, "Cache-Control": "private, no-store" } });
}
