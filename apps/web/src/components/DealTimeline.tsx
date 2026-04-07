import { DealStatus, MilestoneStatus } from "@milestone-mind/shared";
import type { DealDetailView } from "../lib/anchor/queries";

export function DealTimeline({ deal }: Readonly<{ deal: DealDetailView }>) {
  const evidenceSubmittedCount = deal.milestones.filter((milestone) => milestone.submittedAtUnix > 0).length;
  const assessmentsCommittedCount = deal.milestones.filter((milestone) => milestone.assessment !== null).length;
  const releasedCount = deal.milestones.filter((milestone) => BigInt(milestone.releasedAmountRaw) > 0n).length;
  const disputeOpened = deal.statusValue === DealStatus.Disputed
    || deal.milestones.some(
      (milestone) =>
        milestone.statusValue === MilestoneStatus.InDispute
        || milestone.statusValue === MilestoneStatus.Resolved
        || milestone.statusValue === MilestoneStatus.Refunded,
    );
  const disputeResolved = deal.milestones.some(
    (milestone) =>
      milestone.statusValue === MilestoneStatus.Resolved
      || milestone.statusValue === MilestoneStatus.Refunded,
  );
  const finalized = deal.statusValue === DealStatus.Completed;
  const cancelled = deal.statusValue === DealStatus.Cancelled;
  const funded = BigInt(deal.fundedAmountRaw) > 0n;
  const steps = cancelled
    ? [
        {
          title: "Deal created",
          complete: true,
          detail: deal.createdAtLabel,
        },
        {
          title: "Draft cancelled",
          complete: true,
          detail: "The client cancelled the unfunded draft deal.",
        },
      ]
    : [
        {
          title: "Deal created",
          complete: true,
          detail: deal.createdAtLabel,
        },
        {
          title: "Funded",
          complete: funded,
          detail: funded ? `${deal.fundedAmountLabel} moved into escrow.` : "Waiting for client funding.",
        },
        {
          title: "Evidence submitted",
          complete: evidenceSubmittedCount > 0,
          detail:
            evidenceSubmittedCount > 0
              ? `${evidenceSubmittedCount}/${deal.milestoneCount} milestones have recorded evidence.`
              : "No milestone evidence has been submitted yet.",
        },
        {
          title: "Assessment committed",
          complete: assessmentsCommittedCount > 0,
          detail:
            assessmentsCommittedCount > 0
              ? `${assessmentsCommittedCount}/${deal.milestoneCount} milestones have on-chain assessments.`
              : "Awaiting assessor review on submitted evidence.",
        },
        {
          title: "Funds released",
          complete: releasedCount > 0,
          detail:
            releasedCount > 0
              ? `${releasedCount}/${deal.milestoneCount} milestones have released funds.`
              : "No escrow funds have been released yet.",
        },
        {
          title: "Dispute opened",
          complete: disputeOpened,
          detail: disputeOpened
            ? "At least one milestone entered dispute resolution."
            : "No disputes have been opened.",
        },
        {
          title: "Dispute resolved",
          complete: disputeResolved,
          detail: disputeResolved
            ? "A disputed milestone has been resolved or refunded."
            : "No resolved dispute recorded yet.",
        },
        {
          title: "Deal finalized",
          complete: finalized,
          detail: finalized
            ? "All milestones were terminal and the deal reached Completed."
            : "Finalize remains locked until every milestone becomes terminal.",
        },
      ];

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Timeline</p>
          <h2>Lifecycle from chain state</h2>
        </div>
        <p className="muted-copy">Built directly from deal, milestone, and assessment accounts.</p>
      </div>
      <ol className="timeline-list">
        {steps.map((step, index) => (
          <li className={`timeline-item ${step.complete ? "timeline-complete" : "timeline-pending"}`} key={`${step.title}-${index}`}>
            <span className="timeline-dot">{index + 1}</span>
            <div className="timeline-copy">
              <strong>{step.title}</strong>
              <p className="muted-copy">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
