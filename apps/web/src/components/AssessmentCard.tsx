import type { AssessmentView } from "../lib/anchor/queries";
import { formatPubkey } from "../lib/formatters";
import { StatusBadge } from "./StatusBadge";

export function AssessmentCard({ assessment }: Readonly<{ assessment: AssessmentView }>) {
  return (
    <article className="assessment-card">
      <div className="assessment-header">
        <p className="section-eyebrow">Assessment</p>
        <StatusBadge label={assessment.decisionLabel} tone={assessment.decisionTone} />
      </div>
      <p className="assessment-summary">{assessment.summary}</p>
      <dl className="detail-grid compact-grid">
        <div>
          <dt>Approved</dt>
          <dd>{assessment.approvedLabel}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{assessment.confidenceLabel}</dd>
        </div>
        <div>
          <dt>Recorded</dt>
          <dd>{assessment.createdAtLabel}</dd>
        </div>
        <div>
          <dt>Rationale Hash</dt>
          <dd title={assessment.rationaleHashHex}>{formatPubkey(assessment.rationaleHashHex, 6)}</dd>
        </div>
      </dl>
    </article>
  );
}
