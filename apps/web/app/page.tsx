import { DealCard } from "../src/components/DealCard";
import { fetchAllDeals } from "../src/lib/anchor/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const loadResult = await loadHomeState();

  if (loadResult.errorMessage) {
    return (
      <main className="page-shell">
        <section className="page-content">
          <section className="hero-card">
            <div>
              <p className="section-eyebrow">MilestoneMind</p>
              <h1>Escrow lifecycle, visible on-chain.</h1>
            </div>
            <p className="hero-copy">
              The dashboard is configured, but the current RPC or program settings prevented the
              first data load.
            </p>
          </section>
          <section className="panel error-panel">
            <p className="section-eyebrow">All Deals Error</p>
            <h2>Unable to load deals</h2>
            <p className="muted-copy">{loadResult.errorMessage}</p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="page-content">
        <section className="hero-card">
          <div>
            <p className="section-eyebrow">MilestoneMind</p>
            <h1>Escrow lifecycle, visible on-chain.</h1>
          </div>
          <p className="hero-copy">
            Track funded deals, milestone evidence, AI-backed assessments, releases, disputes, and
            settlement outcomes directly from Solana account state.
          </p>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">All Deals</p>
              <h2>Program account index</h2>
            </div>
            <p className="muted-copy">{loadResult.deals.length} deals returned by the configured RPC</p>
          </div>
          {loadResult.deals.length > 0 ? (
            <div className="deal-grid">
              {loadResult.deals.map((deal) => (
                <DealCard deal={deal} key={deal.pubkey} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No deals found</h3>
              <p className="muted-copy">
                This RPC did not return any `Deal` accounts for the configured MilestoneMind
                program yet.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

async function loadHomeState() {
  try {
    return {
      deals: await fetchAllDeals(),
      errorMessage: null,
    };
  } catch (error) {
    return {
      deals: [],
      errorMessage: error instanceof Error ? error.message : "Unknown RPC error.",
    };
  }
}
