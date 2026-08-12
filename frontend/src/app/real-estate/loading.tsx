export default function RealEstateLoading() {
  return (
    <main className="re-main" aria-busy="true" aria-label="Loading Real Estate workspace">
      <div className="re-loading-header" />
      <div className="re-stats re-loading-stats">
        {[1, 2, 3, 4].map((item) => <div className="re-loading-block" key={item} />)}
      </div>
      <section className="re-surface re-loading-panel">
        <div className="re-loading-block" /><div className="re-loading-block" /><div className="re-loading-block" />
      </section>
    </main>
  );
}
