import Link from "next/link";

export type RealEstatePageDefinition = { title: string; section: string; description: string; permission: string; emptyTitle: string; columns: string[] };

export function RealEstateWorkspace({ definition }: { definition: RealEstatePageDefinition }) {
  return <><div className="topbar"><div><span className="context">Hakika Real Estate · {definition.section}</span><h1>{definition.title}</h1></div><div className="context">Scoped live data</div></div><main className="workspace-main"><section className="card panel page-intro"><div><h2>{definition.title}</h2><p>{definition.description}</p></div><span className="status active">Tenant scoped</span></section><section className="card panel data-empty"><div className="empty-mark">+</div><h2>{definition.emptyTitle}</h2><p>This workspace has no records yet. Data will appear only after it is created inside the selected organization and company.</p><Link className="button primary" href="/support">Request setup help</Link></section><section className="card panel table-preview"><div className="panel-header"><h2>Directory view</h2><span>0 records</span></div><div className="table-head">{definition.columns.map((column) => <span key={column}>{column}</span>)}</div><p className="muted">No records match the current organization, company and active-record scope.</p></section></main></>;
}
