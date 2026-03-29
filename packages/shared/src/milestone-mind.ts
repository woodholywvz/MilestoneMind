export const MILESTONE_MIND_MAX_LENGTHS = {
  title: 80,
  evidenceUri: 256,
  evidenceSummary: 280,
  assessmentSummary: 280,
} as const;

type EmptyAnchorEnum = Record<string, never>;

export enum DealStatus {
  Draft = "draft",
  Active = "active",
  Completed = "completed",
  Cancelled = "cancelled",
}

export type DealStatusMirror =
  | { draft: EmptyAnchorEnum }
  | { active: EmptyAnchorEnum }
  | { completed: EmptyAnchorEnum }
  | { cancelled: EmptyAnchorEnum };

export enum MilestoneStatus {
  PendingEvidence = "pendingEvidence",
  UnderReview = "underReview",
  Approved = "approved",
  Rejected = "rejected",
  Released = "released",
}

export type MilestoneStatusMirror =
  | { pendingEvidence: EmptyAnchorEnum }
  | { underReview: EmptyAnchorEnum }
  | { approved: EmptyAnchorEnum }
  | { rejected: EmptyAnchorEnum }
  | { released: EmptyAnchorEnum };

export enum AssessmentDecision {
  Approve = "approve",
  Reject = "reject",
  PartialApprove = "partialApprove",
}

export type AssessmentDecisionMirror =
  | { approve: EmptyAnchorEnum }
  | { reject: EmptyAnchorEnum }
  | { partialApprove: EmptyAnchorEnum };
