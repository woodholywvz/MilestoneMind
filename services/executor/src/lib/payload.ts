import type { BN } from "@coral-xyz/anchor";
import {
  assessRequestSchema,
  assessResponseSchema,
  DealStatus,
  type DealStatusMirror,
  evidenceHashToHex,
  MilestoneStatus,
  type MilestoneStatusMirror,
} from "@milestone-mind/shared";
import type { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import type { DealAccount, MilestoneAccount } from "../anchor/types.js";
import { InvalidExecutorInputError, MilestoneNotReadyError } from "./errors.js";

export const dryAssessOptionsSchema = z.object({
  dealId: z.number().int().nonnegative(),
  milestoneIndex: z.number().int().nonnegative(),
});

export interface DryAssessAddresses {
  dealPublicKey: PublicKey;
  milestonePublicKey: PublicKey;
}

export type DryAssessOptions = z.infer<typeof dryAssessOptionsSchema>;

export function buildAssessRequest(
  accounts: DryAssessAddresses & {
    deal: DealAccount;
    milestone: MilestoneAccount;
  },
) {
  const payload = {
    dealPubkey: accounts.dealPublicKey.toBase58(),
    milestonePubkey: accounts.milestonePublicKey.toBase58(),
    milestoneIndex: accounts.milestone.index,
    dealTitle: accounts.deal.title,
    milestoneTitle: accounts.milestone.title,
    milestoneAmount: bnToSafeNumber(
      accounts.milestone.amount,
      "milestone.amount",
    ),
    evidenceUri: accounts.milestone.evidenceUri,
    evidenceHashHex: evidenceHashToHex(accounts.milestone.evidenceHash),
    evidenceSummary: accounts.milestone.evidenceSummary,
    attachmentCount: accounts.milestone.attachmentCount,
  };

  return assessRequestSchema.parse(payload);
}

export function parseAiAssessmentResponse(payload: unknown) {
  return assessResponseSchema.parse(payload);
}

export function assertMilestoneReadyForAssessment(
  milestone: Pick<MilestoneAccount, "status">,
): void {
  const status = parseMilestoneStatus(milestone.status);

  if (status !== MilestoneStatus.EvidenceSubmitted) {
    throw new MilestoneNotReadyError(status);
  }
}

export function parseDealStatus(status: DealStatusMirror): DealStatus {
  const normalized = extractAnchorEnumKey(status);

  if (!Object.values(DealStatus).includes(normalized as DealStatus)) {
    throw new InvalidExecutorInputError(`Unsupported deal status: ${normalized}`);
  }

  return normalized as DealStatus;
}

export function parseMilestoneStatus(status: MilestoneStatusMirror): MilestoneStatus {
  const normalized = extractAnchorEnumKey(status);

  if (!Object.values(MilestoneStatus).includes(normalized as MilestoneStatus)) {
    throw new InvalidExecutorInputError(`Unsupported milestone status: ${normalized}`);
  }

  return normalized as MilestoneStatus;
}

export function bnToSafeNumber(value: BN, fieldName: string): number {
  const bigintValue = BigInt(value.toString());

  if (bigintValue > BigInt(Number.MAX_SAFE_INTEGER) || bigintValue < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new InvalidExecutorInputError(
      `${fieldName} exceeds JavaScript safe integer range.`,
    );
  }

  return Number(bigintValue);
}

function extractAnchorEnumKey(value: Record<string, unknown>): string {
  const keys = Object.keys(value);

  if (keys.length !== 1) {
    throw new InvalidExecutorInputError("Anchor enum mirror must contain exactly one variant.");
  }

  return keys[0] ?? "";
}
