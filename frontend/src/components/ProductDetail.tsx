import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";

type ProductDetailProps = {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
};

export function ProductDetail({ eyebrow, title, description, points }: ProductDetailProps) {
  return (
    <PublicShell>
      <main className="public-main">
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p className="section-intro">{description}</p>
        <div className="feature-grid">
          {points.map((point) => (
            <div className="feature" key={point}>
              <h3>{point}</h3>
              <p>Keep the right people, records and decisions connected in one secure operating context.</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 28 }}><Link className="button" href="/contact">Talk to our team</Link></p>
      </main>
    </PublicShell>
  );
}
