import type { MilestoneView } from "../lib/anchor/queries";
import { AssessmentCard } from "./AssessmentCard";
import { StatusBadge } from "./StatusBadge";

export function MilestoneList({ milestones }: Readonly<{ milestones: MilestoneView[] }>) {
  if (milestones.length === 0) {
    return (
      <section className="panel">
        <p className="section-eyebrow">Milestones</p>
        <h2>No milestones found</h2>
        <p className="muted-copy">This deal exists on-chain, but no milestone accounts were returned for it yet.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Milestones</p>
          <h2>Execution trail</h2>
        </div>
        <p className="muted-copy">{milestones.length} milestones decoded from chain state</p>
      </div>
      <div className="milestone-list">
        {milestones.map((milestone) => (
          <article className="milestone-card" key={milestone.pubkey}>
            <div className="milestone-header">
              <div>
                <p className="milestone-index">Milestone #{milestone.index}</p>
                <h3>{milestone.title}</h3>
              </div>
              <StatusBadge label={milestone.statusLabel} tone={milestone.statusTone} />
            </div>
            <dl className="detail-grid">
              <div>
                <dt>Amount</dt>
                <dd>{milestone.amountLabel}</dd>
              </div>
              <div>
                <dt>Released</dt>
                <dd>{milestone.releasedAmountLabel}</dd>
              </div>
              <div>
                <dt>Attachments</dt>
                <dd>{milestone.attachmentCount}</dd>
              </div>
              <div>
                <dt>Last Submitted</dt>
                <dd>{milestone.submittedAtLabel}</dd>
              </div>
            </dl>
            <div className="evidence-block">
              <div>
                <p className="sub-eyebrow">Evidence URI</p>
                <p className="evidence-copy">{milestone.evidenceUri || "No URI recorded"}</p>
              </div>
              <div>
                <p className="sub-eyebrow">Evidence Summary</p>
                <p className="evidence-copy">{milestone.evidenceSummary || "No summary recorded"}</p>
              </div>
            </div>
            {milestone.assessment ? <AssessmentCard assessment={milestone.assessment} /> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
