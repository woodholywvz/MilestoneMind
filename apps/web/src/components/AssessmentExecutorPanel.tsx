"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import type {
  ExecutorAssessCommitResponse,
  ExecutorAssessDryResponse,
  ServiceAssessmentDecision,
} from "@milestone-mind/shared";
import { MilestoneStatus } from "@milestone-mind/shared";
import { buildExplorerTransactionUrl } from "../lib/explorer";
import {
  formatAssessmentDecisionValue,
  formatBps,
  formatMilestoneStatusValue,
  formatPubkey,
} from "../lib/formatters";
import {
  ExecutorApiError,
  requestExecutorCommitAssessment,
  requestExecutorDryAssessment,
} from "../lib/executor/client";
import { StatusBadge } from "./StatusBadge";

type AssessmentExecutionResult =
  | {
      mode: "dry";
      response: ExecutorAssessDryResponse;
    }
  | {
      mode: "commit";
      response: ExecutorAssessCommitResponse;
    };

interface AssessmentExecutorPanelProps {
  dealId: number;
  milestone: {
    index: number;
    statusValue: MilestoneStatus;
  };
  platformAdminPubkey: string | null;
  platformAssessorPubkey: string | null;
}

export function AssessmentExecutorPanel({
  dealId,
  milestone,
  platformAdminPubkey,
  platformAssessorPubkey,
}: Readonly<AssessmentExecutorPanelProps>) {
  const router = useRouter();
  const wallet = useWallet();
  const [result, setResult] = useState<AssessmentExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<"dry" | "commit" | null>(null);
  const role = useMemo(
    () => resolvePanelRole(wallet.publicKey?.toBase58() ?? null, {
      admin: platformAdminPubkey,
      assessor: platformAssessorPubkey,
    }),
    [platformAdminPubkey, platformAssessorPubkey, wallet.publicKey],
  );
  const canAssess = milestone.statusValue === MilestoneStatus.EvidenceSubmitted;

  if (!role) {
    return null;
  }

  async function handleDryAssess() {
    setPendingMode("dry");
    setErrorMessage(null);

    try {
      const response = await requestExecutorDryAssessment({
        dealId,
        milestoneIndex: milestone.index,
      });
      setResult({ mode: "dry", response });
    } catch (error) {
      setErrorMessage(toExecutorMessage(error));
    } finally {
      setPendingMode(null);
    }
  }

  async function handleCommitAssess() {
    setPendingMode("commit");
    setErrorMessage(null);

    try {
      const response = await requestExecutorCommitAssessment({
        dealId,
        milestoneIndex: milestone.index,
      });
      setResult({ mode: "commit", response });
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(toExecutorMessage(error));
    } finally {
      setPendingMode(null);
    }
  }

  return (
    <section className="assessment-executor-card">
      <div className="progress-title-row">
        <div>
          <p className="section-eyebrow">Assessment Panel</p>
          <h4>Executor-driven assessor flow</h4>
        </div>
        <span className="wallet-pill">{role}</span>
      </div>

      <p className="muted-copy">
        This MVP gates the panel by connected wallet role from `PlatformConfig`, then calls the
        executor HTTP service for dry-run or commit. No backend session or OAuth layer is added.
      </p>

      {canAssess ? (
        <div className="assessment-actions">
          <button
            className="secondary-button"
            disabled={pendingMode !== null}
            onClick={handleDryAssess}
            type="button"
          >
            {pendingMode === "dry" ? "Assessing..." : "Dry assess"}
          </button>
          <button
            className="primary-button"
            disabled={pendingMode !== null}
            onClick={handleCommitAssess}
            type="button"
          >
            {pendingMode === "commit" ? "Committing..." : "Commit assess"}
          </button>
        </div>
      ) : (
        <p className="muted-copy">
          Assessment actions are available only while the milestone status is Evidence Submitted.
        </p>
      )}

      {errorMessage ? <p className="field-error submit-error">{errorMessage}</p> : null}
      {result ? <AssessmentExecutorResultCard result={result} /> : null}
    </section>
  );
}

function AssessmentExecutorResultCard({
  result,
}: Readonly<{
  result: AssessmentExecutionResult;
}>) {
  const verdict = result.response.verdict;
  const decision = formatAssessmentDecisionValue(verdict.decision as ServiceAssessmentDecision);
  const milestoneStatus =
    result.mode === "commit"
      ? formatMilestoneStatusValue(result.response.milestoneStatus)
      : null;

  return (
    <article className="assessment-card assessment-result-card">
      <div className="assessment-header">
        <p className="section-eyebrow">
          {result.mode === "commit" ? "Committed Verdict" : "Dry Verdict"}
        </p>
        <StatusBadge label={decision.label} tone={decision.tone} />
      </div>
      <p className="assessment-summary">{verdict.summary}</p>
      <dl className="detail-grid compact-grid">
        <div>
          <dt>Confidence</dt>
          <dd>{formatBps(verdict.confidenceBps)}</dd>
        </div>
        <div>
          <dt>Approved</dt>
          <dd>{formatBps(verdict.approvedBps)}</dd>
        </div>
        <div>
          <dt>Rationale Hash</dt>
          <dd title={verdict.rationaleHashHex}>{formatPubkey(verdict.rationaleHashHex, 8)}</dd>
        </div>
        <div>
          <dt>Engine</dt>
          <dd>{verdict.engineVersion}</dd>
        </div>
        {milestoneStatus ? (
          <div>
            <dt>New Status</dt>
            <dd>
              <StatusBadge label={milestoneStatus.label} tone={milestoneStatus.tone} />
            </dd>
          </div>
        ) : null}
        {result.mode === "commit" ? (
          <div>
            <dt>Tx Signature</dt>
            <dd>
              <a
                href={buildExplorerTransactionUrl(result.response.txSignature)}
                rel="noreferrer"
                target="_blank"
              >
                {formatPubkey(result.response.txSignature, 8)}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="rule-trace">
        <p className="sub-eyebrow">Rule Trace</p>
        <ol className="rule-trace-list">
          {verdict.ruleTrace.map((item, index) => (
            <li key={`${result.response.requestId}-${index}`}>{item}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}

function resolvePanelRole(
  walletPubkey: string | null,
  platform: { admin: string | null; assessor: string | null },
): string | null {
  if (!walletPubkey) {
    return null;
  }

  const isAdmin = walletPubkey === platform.admin;
  const isAssessor = walletPubkey === platform.assessor;

  if (isAdmin && isAssessor) {
    return "Admin / Assessor";
  }

  if (isAdmin) {
    return "Admin";
  }

  if (isAssessor) {
    return "Assessor";
  }

  return null;
}

function toExecutorMessage(error: unknown): string {
  if (error instanceof ExecutorApiError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Executor request failed.";
}
