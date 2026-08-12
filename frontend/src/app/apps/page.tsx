import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAccessibleApplications } from "@/lib/auth/applications";
import { requireAuthenticatedUser } from "@/lib/auth/server";
import { requireHakikaLoginVerification } from "@/lib/auth/server";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Apps({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireHakikaLoginVerification("/apps");
  let result;
  const params = await searchParams;
  const organization = typeof params.organization === "string" ? params.organization : undefined;
  const company = typeof params.company === "string" ? params.company : undefined;
  try { result = await getAccessibleApplications(organization, company); } catch (error) {
    console.error("[launcher] access resolution failed", error instanceof Error ? error.message : "unknown");
    try { await requireAuthenticatedUser(); return <main className="launcher-main"><section className="card launcher-empty"><div className="empty-mark">!</div><h2>Workspace access needs setup</h2><p>Your credentials were accepted, but this account does not have an active Hakika organization membership or application assignment yet.</p><Link className="button primary" href="/support">Contact support</Link></section></main>; } catch { redirect("/login?next=%2Fapps"); }
  }
  if (!result) redirect("/login");
  const { context, applications } = result;
  const identity = await requireAuthenticatedUser();
  const claims = identity.claims as Record<string, unknown>;
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object" ? claims.user_metadata as Record<string, unknown> : {};
  const displayName = typeof metadata.full_name === "string" && metadata.full_name.trim() ? metadata.full_name.trim() : typeof metadata.name === "string" && metadata.name.trim() ? metadata.name.trim() : typeof claims.email === "string" ? claims.email : "Signed-in user";
  return <main className="launcher-main">
    <div className="launcher-head"><div><div className="eyebrow">Hakika Business OS</div><h1>Your applications</h1><p>{context.organizationName}{context.companyName ? ` · ${context.companyName}` : ""}</p></div><div className="launcher-user"><span className="launcher-user-label">Signed in as</span><strong className="launcher-user-name">{displayName}</strong><Link className="button" href="/">Back to home</Link><SignOutButton /></div></div>
    {applications.length ? <div className="app-grid">{applications.map((app) => <Link className="card app-card" key={app.key} href={app.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${app.name} in a new tab`}>{app.logo ? <Image className="app-logo" src={app.logo} width={72} height={72} alt={app.logoAlt} /> : <div className="app-logo fallback" role="img" aria-label={app.logoAlt}>{app.name.slice(0, 1)}</div>}<div><h2>{app.name}</h2><p>{app.description}</p><div className="app-foot"><span className={`status ${app.status}`}>{app.status === "trial" ? "Trial" : "Active"}</span><span className="open-action">Open <span aria-hidden="true">→</span></span></div></div></Link>)}</div> : <section className="card launcher-empty"><div className="empty-mark">+</div><h2>No applications assigned yet</h2><p>Your organization has no active application entitlement for this account. Ask a Customer Admin to assign an application.</p><Link className="button primary" href="/support">Contact support</Link></section>}
    <p className="muted launcher-note">Access is checked on the server for every application. Opening a new tab reuses this secure session and does not create a separate application password.</p>
  </main>;
}
