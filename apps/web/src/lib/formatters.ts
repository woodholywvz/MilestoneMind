import {
  AssessmentDecision,
  type AssessmentDecisionMirror,
  DealStatus,
  type DealStatusMirror,
  MilestoneStatus,
  type MilestoneStatusMirror,
  MOCK_USDC_DECIMALS,
} from "@milestone-mind/shared";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

type AnchorEnumMirror = Record<string, Record<string, never>>;
type NumericLike = bigint | number | string | { toString(): string };

export function formatTokenAmount(
  value: NumericLike,
  decimals = MOCK_USDC_DECIMALS,
): string {
  const normalized = value.toString();
  const negative = normalized.startsWith("-");
  const digits = negative ? normalized.slice(1) : normalized;
  const whole = digits.padStart(decimals + 1, "0");
  const integerPart = whole.slice(0, -decimals);
  const fractionPart = whole.slice(-decimals).replace(/0+$/, "");
  const formattedInteger = Number.parseInt(integerPart, 10).toLocaleString("en-US");
  const result = fractionPart ? `${formattedInteger}.${fractionPart}` : formattedInteger;
  return `${negative ? "-" : ""}${result} USDC`;
}

export function formatBps(value: number): string {
  return `${(value / 100).toFixed(2)}%`;
}

export function formatPubkey(value: string, visibleChars = 4): string {
  if (value.length <= visibleChars * 2) {
    return value;
  }

  return `${value.slice(0, visibleChars)}...${value.slice(-visibleChars)}`;
}

export function formatTimestamp(value: NumericLike): string {
  const seconds = Number.parseInt(value.toString(), 10);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "Not recorded";
  }

  return new Date(seconds * 1000).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDealStatus(status: DealStatusMirror): {
  label: string;
  tone: StatusTone;
  value: DealStatus;
} {
  const value = enumValue(status) as DealStatus;

  switch (value) {
    case DealStatus.Draft:
      return { label: "Draft", tone: "neutral", value };
    case DealStatus.Funded:
      return { label: "Funded", tone: "info", value };
    case DealStatus.InProgress:
      return { label: "In Progress", tone: "info", value };
    case DealStatus.Disputed:
      return { label: "Disputed", tone: "danger", value };
    case DealStatus.Completed:
      return { label: "Completed", tone: "success", value };
    case DealStatus.Cancelled:
      return { label: "Cancelled", tone: "warning", value };
  }
}

export function formatMilestoneStatus(status: MilestoneStatusMirror): {
  label: string;
  tone: StatusTone;
  value: MilestoneStatus;
} {
  const value = enumValue(status) as MilestoneStatus;

  switch (value) {
    case MilestoneStatus.PendingEvidence:
      return { label: "Pending Evidence", tone: "neutral", value };
    case MilestoneStatus.EvidenceSubmitted:
      return { label: "Evidence Submitted", tone: "info", value };
    case MilestoneStatus.Approved:
      return { label: "Approved", tone: "success", value };
    case MilestoneStatus.OnHold:
      return { label: "On Hold", tone: "warning", value };
    case MilestoneStatus.InDispute:
      return { label: "In Dispute", tone: "danger", value };
    case MilestoneStatus.PaidPartial:
      return { label: "Paid Partial", tone: "info", value };
    case MilestoneStatus.PaidFull:
      return { label: "Paid Full", tone: "success", value };
    case MilestoneStatus.Resolved:
      return { label: "Resolved", tone: "success", value };
    case MilestoneStatus.Refunded:
      return { label: "Refunded", tone: "warning", value };
  }
}

export function formatAssessmentDecision(decision: AssessmentDecisionMirror): {
  label: string;
  tone: StatusTone;
  value: AssessmentDecision;
} {
  const value = enumValue(decision) as AssessmentDecision;

  switch (value) {
    case AssessmentDecision.Approve:
      return { label: "Approve", tone: "success", value };
    case AssessmentDecision.Hold:
      return { label: "Hold", tone: "warning", value };
    case AssessmentDecision.Dispute:
      return { label: "Dispute", tone: "danger", value };
  }
}

function enumValue(value: AnchorEnumMirror): string {
  return Object.keys(value)[0] ?? "unknown";
}
