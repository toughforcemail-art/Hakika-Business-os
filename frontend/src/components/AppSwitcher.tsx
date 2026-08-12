import Link from "next/link";
import { getAccessibleApplications } from "@/lib/auth/applications";

export async function AppSwitcher() {
  try {
    const { applications } = await getAccessibleApplications();
    return applications.length ? <div className="app-switcher"><span>Switch app</span>{applications.map((application) => <Link key={application.key} href={application.href}>{application.name}</Link>)}</div> : null;
  } catch { return null; }
}
