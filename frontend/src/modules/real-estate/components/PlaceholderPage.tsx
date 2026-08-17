import Link from "next/link";
import { ReButton, ReHeader } from "./Shell";

export type PlaceholderLink = { label: string; href: string };

export function PlaceholderPage({
  eyebrow = "Real Estate workspace",
  title,
  description,
  links = [],
}: {
  eyebrow?: string;
  title: string;
  description: string;
  links?: PlaceholderLink[];
}) {
  return (
    <main className="re-main">
      <ReHeader eyebrow={eyebrow} title={title} description={description} />
      <section className="re-surface re-empty-state">
        <div className="re-empty-mark" aria-hidden="true">⌁</div>
        <h2>Workflow ready for connected data</h2>
        <p>This route is intentionally scaffolded. Records, mutations, and integrations will be enabled when the supporting schema and service contract are available.</p>
        <div className="re-page-actions">
          <ReButton href="/real-estate/dashboard" variant="secondary">Back to dashboard</ReButton>
          {links.map((link) => <Link className="re-button primary" href={link.href} key={link.href}>{link.label}</Link>)}
        </div>
      </section>
    </main>
  );
}
