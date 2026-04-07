import Link from "next/link";
import { notFound } from "next/navigation";
import { MilestoneList } from "../../../src/components/MilestoneList";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { fetchDealDetail } from "../../../src/lib/anchor/queries";
import { formatPubkey } from "../../../src/lib/formatters";

export const dynamic = "force-dynamic";

export default async function DealDetailPage({
  params,
}: Readonly<{
  params: Promise<{ dealPubkey: string }>;
}>) {
  const { dealPubkey } = await params;
  const loadResult = await loadDealState(dealPubkey);

  if (loadResult.kind === "not-found") {
    notFound();
  }

  if (loadResult.kind === "error") {
    return (
      <main className="page-shell">
        <section className="page-content">
          <div className="panel error-panel">
            <p className="section-eyebrow">Deal Detail Error</p>
            <h1>Unable to load this deal.</h1>
            <p className="muted-copy">{loadResult.message}</p>
            <Link className="primary-link" href="/">
              Back to all deals
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { deal } = loadResult;

  return (
    <main className="page-shell">
      <section className="page-content detail-page">
        <div className="detail-hero">
          <div>
            <Link className="back-link" href="/">
              All Deals
            </Link>
            <p className="section-eyebrow">Deal #{deal.dealId}</p>
            <h1>{deal.title}</h1>
          </div>
          <StatusBadge label={deal.statusLabel} tone={deal.statusTone} />
        </div>

        <section className="panel">
          <div className="section-header">
            <div>
              <p className="section-eyebrow">Deal Summary</p>
              <h2>Escrow and counterparties</h2>
            </div>
            <a className="text-link" href={deal.explorerHref} rel="noreferrer" target="_blank">
              View on explorer
            </a>
          </div>
          <dl className="detail-grid">
            <div>
              <dt>Deal Pubkey</dt>
              <dd title={deal.pubkey}>{formatPubkey(deal.pubkey, 6)}</dd>
            </div>
            <div>
              <dt>Vault Authority</dt>
              <dd>
                <a href={deal.vaultAuthorityExplorerHref} rel="noreferrer" target="_blank">
                  {formatPubkey(deal.vaultAuthority, 6)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Client</dt>
              <dd>
                <a href={deal.clientExplorerHref} rel="noreferrer" target="_blank">
                  {formatPubkey(deal.clientPubkey, 6)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Freelancer</dt>
              <dd>
                <a href={deal.freelancerExplorerHref} rel="noreferrer" target="_blank">
                  {formatPubkey(deal.freelancerPubkey, 6)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Mint</dt>
              <dd>
                <a href={deal.mintExplorerHref} rel="noreferrer" target="_blank">
                  {formatPubkey(deal.mintPubkey, 6)}
                </a>
              </dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{deal.createdAtLabel}</dd>
            </div>
            <div>
              <dt>Total Amount</dt>
              <dd>{deal.totalAmountLabel}</dd>
            </div>
            <div>
              <dt>Funded Amount</dt>
              <dd>{deal.fundedAmountLabel}</dd>
            </div>
            <div>
              <dt>Milestones</dt>
              <dd>{deal.milestoneCount}</dd>
            </div>
            <div>
              <dt>Settled Milestones</dt>
              <dd>{deal.settledMilestones}</dd>
            </div>
          </dl>
        </section>

        <MilestoneList
          dealPubkey={deal.pubkey}
          dealStatusValue={deal.statusValue}
          freelancerPubkey={deal.freelancerPubkey}
          milestones={deal.milestones}
        />
      </section>
    </main>
  );
}

async function loadDealState(dealPubkey: string) {
  try {
    const deal = await fetchDealDetail(dealPubkey);

    if (deal === null) {
      return { kind: "not-found" as const };
    }

    return { kind: "ok" as const, deal };
  } catch (error) {
    return {
      kind: "error" as const,
      message: error instanceof Error ? error.message : "Unknown RPC error.",
    };
  }
}
