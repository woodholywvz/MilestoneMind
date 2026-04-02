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
  Disputed = "disputed",
  Completed = "completed",
  Cancelled = "cancelled",
}

export type DealStatusMirror =
  | { draft: EmptyAnchorEnum }
  | { funded: EmptyAnchorEnum }
  | { inProgress: EmptyAnchorEnum }
  | { disputed: EmptyAnchorEnum }
  | { completed: EmptyAnchorEnum }
  | { cancelled: EmptyAnchorEnum };

export enum MilestoneStatus {
  PendingEvidence = "pendingEvidence",
  EvidenceSubmitted = "evidenceSubmitted",
  Approved = "approved",
  OnHold = "onHold",
  InDispute = "inDispute",
  PaidFull = "paidFull",
  Resolved = "resolved",
  Refunded = "refunded",
}

export type MilestoneStatusMirror =
  | { pendingEvidence: EmptyAnchorEnum }
  | { evidenceSubmitted: EmptyAnchorEnum }
  | { approved: EmptyAnchorEnum }
  | { onHold: EmptyAnchorEnum }
  | { inDispute: EmptyAnchorEnum }
  | { paidFull: EmptyAnchorEnum }
  | { resolved: EmptyAnchorEnum }
  | { refunded: EmptyAnchorEnum };

export enum AssessmentDecision {
  Approve = "approve",
  Hold = "hold",
  Dispute = "dispute",
}

export type AssessmentDecisionMirror =
  | { approve: EmptyAnchorEnum }
  | { hold: EmptyAnchorEnum }
  | { dispute: EmptyAnchorEnum };
