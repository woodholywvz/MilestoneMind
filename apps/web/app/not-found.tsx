import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page-shell">
      <section className="panel error-panel">
        <p className="section-eyebrow">Not Found</p>
        <h1>Deal page is unavailable.</h1>
        <p className="muted-copy">
          The requested deal pubkey could not be decoded or no deal account exists at that address.
        </p>
        <Link className="primary-link" href="/">
          Back to all deals
        </Link>
      </section>
    </main>
  );
}
