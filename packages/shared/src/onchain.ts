import type { BN } from "@coral-xyz/anchor";
import type { PublicKey } from "@solana/web3.js";
import type {
  AssessmentDecisionMirror,
  DealStatusMirror,
  MilestoneStatusMirror,
} from "./milestone-mind.js";

export interface PlatformConfigAccount {
  admin: PublicKey;
  assessor: PublicKey;
  usdcMint: PublicKey;
  nextDealId: BN;
  bump: number;
}

export interface DealAccount {
  dealId: BN;
  client: PublicKey;
  freelancer: PublicKey;
  mint: PublicKey;
  totalAmount: BN;
  fundedAmount: BN;
  milestoneCount: number;
  settledMilestones: number;
  status: DealStatusMirror;
  title: string;
  createdAt: BN;
  bump: number;
}

export interface MilestoneAccount {
  deal: PublicKey;
  index: number;
  title: string;
  amount: BN;
  releasedAmount: BN;
  status: MilestoneStatusMirror;
  evidenceUri: string;
  evidenceHash: ArrayLike<number>;
  evidenceSummary: string;
  attachmentCount: number;
  lastSubmittedAt: BN;
  bump: number;
}

export interface AssessmentAccount {
  milestone: PublicKey;
  assessor: PublicKey;
  decision: AssessmentDecisionMirror;
  confidenceBps: number;
  approvedBps: number;
  rationaleHash: ArrayLike<number>;
  summary: string;
  createdAt: BN;
  bump: number;
}

export interface DerivedPda {
  publicKey: PublicKey;
  bump: number;
}
