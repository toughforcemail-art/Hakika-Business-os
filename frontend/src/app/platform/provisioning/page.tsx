import Link from "next/link";
import { requireApplicationContext } from "@/lib/platform/context";
import { ProvisioningForm } from "./ProvisioningForm";

export default async function ProvisioningPage() {
  const ctx = await requireApplicationContext("PLATFORM_ADMIN");
  const { data: applications } = await ctx.supabase.schema("platform").from("applications").select("application_key,name,description").eq("status", "active").in("application_key", ["REAL_ESTATE", "HR", "FINANCE", "TOUGHFORCE"]).order("name");
  return <main className="workspace-main platform-provisioning-page">
    <header className="re-page-header"><div><span className="re-eyebrow">Platform provisioning</span><h1>Rent a workspace to a customer</h1><p>Create the organization, connect its applications, and send the Director a secure invitation in one controlled workflow.</p></div><Link className="re-button secondary" href="/platform/dashboard">Back to dashboard</Link></header>
    <ProvisioningForm applications={applications ?? []}/>
  </main>;
}
