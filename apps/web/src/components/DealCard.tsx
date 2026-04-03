import Link from "next/link";
import type { DealListItem } from "../lib/anchor/queries";
import { formatPubkey } from "../lib/formatters";
import { StatusBadge } from "./StatusBadge";

export function DealCard({ deal }: Readonly<{ deal: DealListItem }>) {
  return (
    <article className="deal-card">
      <div className="deal-card-top">
        <div>
          <p className="section-eyebrow">Deal #{deal.dealId}</p>
          <h3>{deal.title}</h3>
        </div>
        <StatusBadge label={deal.statusLabel} tone={deal.statusTone} />
      </div>
      <dl className="detail-grid">
        <div>
          <dt>Total</dt>
          <dd>{deal.totalAmountLabel}</dd>
        </div>
        <div>
          <dt>Funded</dt>
          <dd>{deal.fundedAmountLabel}</dd>
        </div>
        <div>
          <dt>Milestones</dt>
          <dd>{deal.milestoneCount}</dd>
        </div>
        <div>
          <dt>Settled</dt>
          <dd>{deal.settledMilestones}</dd>
        </div>
        <div>
          <dt>Client</dt>
          <dd title={deal.clientPubkey}>{formatPubkey(deal.clientPubkey, 5)}</dd>
        </div>
        <div>
          <dt>Freelancer</dt>
          <dd title={deal.freelancerPubkey}>{formatPubkey(deal.freelancerPubkey, 5)}</dd>
        </div>
      </dl>
      <div className="deal-card-footer">
        <span className="muted-copy">Created {deal.createdAtLabel}</span>
        <div className="link-row">
          <Link className="text-link" href={deal.detailHref}>
            Open deal
          </Link>
          <a className="text-link" href={deal.explorerHref} rel="noreferrer" target="_blank">
            Explorer
          </a>
        </div>
      </div>
    </article>
  );
}
