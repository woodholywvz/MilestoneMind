export default function Loading() {
  return (
    <main className="page-shell">
      <section className="panel loading-panel">
        <p className="section-eyebrow">MilestoneMind</p>
        <h1>Loading on-chain state...</h1>
        <p className="muted-copy">The dashboard is reading deal and milestone accounts from the configured RPC.</p>
      </section>
    </main>
  );
}
