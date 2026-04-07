import { StatusBadge } from "./StatusBadge";

export type TransactionProgressStatus = "upcoming" | "pending" | "success" | "error";

export interface TransactionProgressItem {
  id: string;
  label: string;
  status: TransactionProgressStatus;
  signature?: string;
  explorerHref?: string;
  detail?: string;
}

const STATUS_META: Record<
  TransactionProgressStatus,
  { label: string; tone: "neutral" | "info" | "success" | "danger" }
> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  pending: { label: "Pending", tone: "info" },
  success: { label: "Confirmed", tone: "success" },
  error: { label: "Failed", tone: "danger" },
};

export function TransactionProgressPanel({
  steps,
}: Readonly<{
  steps: TransactionProgressItem[];
}>) {
  if (steps.length === 0) {
    return null;
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Transaction Progress</p>
          <h2>Create and fund flow</h2>
        </div>
        <p className="muted-copy">Each transaction is submitted and confirmed before the next step starts.</p>
      </div>
      <div className="progress-list">
        {steps.map((step, index) => {
          const meta = STATUS_META[step.status];
          return (
            <article className={`progress-row progress-${step.status}`} key={step.id}>
              <div className="progress-index">{index + 1}</div>
              <div className="progress-copy">
                <div className="progress-title-row">
                  <h3>{step.label}</h3>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </div>
                {step.detail ? <p className="muted-copy">{step.detail}</p> : null}
                {step.signature ? (
                  <div className="link-row">
                    <code>{step.signature}</code>
                    {step.explorerHref ? (
                      <a className="text-link" href={step.explorerHref} rel="noreferrer" target="_blank">
                        Explorer
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
