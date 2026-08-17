import { notFound } from "next/navigation";
import { PlaceholderPage } from "@/modules/real-estate/components/PlaceholderPage";

const pages: Record<string, { title: string; description: string }> = {
  lease: { title: "My lease", description: "Review the lease currently associated with your tenant account." },
  invoices: { title: "My invoices", description: "Review invoices issued to your tenant account." },
  receipts: { title: "My receipts", description: "Review receipts generated from confirmed allocations." },
  statement: { title: "My statement", description: "Review your tenant-scoped statement activity." },
  messages: { title: "Messages", description: "Tenant messaging is protected and ready for the messaging service." },
  maintenance: { title: "Maintenance requests", description: "Raise and follow up on maintenance requests for your home." },
  documents: { title: "Lease documents", description: "Review documents shared with your tenant account." },
};

export default async function TenantPortalSection({ params }: { params: Promise<{ section: string[] }> }) {
  const key = (await params).section.join("/");
  const page = pages[key];
  if (!page) notFound();
  return <PlaceholderPage eyebrow="Tenant portal" title={page.title} description={page.description} links={[{ label: "Back to dashboard", href: "/tenant/dashboard" }]} />;
}
