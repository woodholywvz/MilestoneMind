export const MILESTONE_MIND_MAX_LENGTHS = {
  title: 80,
  evidenceUri: 256,
  evidenceSummary: 280,
  assessmentSummary: 280,
} as const;

export const MOCK_USDC_DECIMALS = 6;

type EmptyAnchorEnum = Record<string, never>;

export enum DealStatus {
  Draft = "draft",
  Funded = "funded",
  InProgress = "inProgress",
  Completed = "completed",
  Cancelled = "cancelled",
}

export type DealStatusMirror =
  | { draft: EmptyAnchorEnum }
  | { funded: EmptyAnchorEnum }
  | { inProgress: EmptyAnchorEnum }
  | { completed: EmptyAnchorEnum }
  | { cancelled: EmptyAnchorEnum };

export enum MilestoneStatus {
  PendingEvidence = "pendingEvidence",
  EvidenceSubmitted = "evidenceSubmitted",
  OnHold = "onHold",
  PaidFull = "paidFull",
  Resolved = "resolved",
  Refunded = "refunded",
}

export type MilestoneStatusMirror =
  | { pendingEvidence: EmptyAnchorEnum }
  | { evidenceSubmitted: EmptyAnchorEnum }
  | { onHold: EmptyAnchorEnum }
  | { paidFull: EmptyAnchorEnum }
  | { resolved: EmptyAnchorEnum }
  | { refunded: EmptyAnchorEnum };

export enum AssessmentDecision {
  Approve = "approve",
  Reject = "reject",
  PartialApprove = "partialApprove",
}

export type AssessmentDecisionMirror =
  | { approve: EmptyAnchorEnum }
  | { reject: EmptyAnchorEnum }
  | { partialApprove: EmptyAnchorEnum };
