import { createHash } from "node:crypto";
import type { Idl } from "@coral-xyz/anchor";

function discriminator(namespace: string, name: string): number[] {
  return [...createHash("sha256").update(`${namespace}:${name}`).digest().subarray(0, 8)];
}

export const milestoneMindIdl = {
  address: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x",
  metadata: {
    name: "milestone_mind",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [],
  accounts: [
    {
      name: "PlatformConfig",
      discriminator: discriminator("account", "PlatformConfig"),
    },
    {
      name: "Deal",
      discriminator: discriminator("account", "Deal"),
    },
    {
      name: "Milestone",
      discriminator: discriminator("account", "Milestone"),
    },
    {
      name: "Assessment",
      discriminator: discriminator("account", "Assessment"),
    },
  ],
  types: [
    {
      name: "PlatformConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "admin", type: "pubkey" },
          { name: "assessor", type: "pubkey" },
          { name: "usdc_mint", type: "pubkey" },
          { name: "next_deal_id", type: "u64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Deal",
      type: {
        kind: "struct",
        fields: [
          { name: "deal_id", type: "u64" },
          { name: "client", type: "pubkey" },
          { name: "freelancer", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "total_amount", type: "u64" },
          { name: "funded_amount", type: "u64" },
          { name: "milestone_count", type: "u16" },
          { name: "settled_milestones", type: "u16" },
          { name: "status", type: { defined: { name: "DealStatus" } } },
          { name: "title", type: "string" },
          { name: "created_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Milestone",
      type: {
        kind: "struct",
        fields: [
          { name: "deal", type: "pubkey" },
          { name: "index", type: "u16" },
          { name: "title", type: "string" },
          { name: "amount", type: "u64" },
          { name: "released_amount", type: "u64" },
          { name: "status", type: { defined: { name: "MilestoneStatus" } } },
          { name: "evidence_uri", type: "string" },
          { name: "evidence_hash", type: { array: ["u8", 32] } },
          { name: "evidence_summary", type: "string" },
          { name: "attachment_count", type: "u16" },
          { name: "last_submitted_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "Assessment",
      type: {
        kind: "struct",
        fields: [
          { name: "milestone", type: "pubkey" },
          { name: "assessor", type: "pubkey" },
          { name: "decision", type: { defined: { name: "AssessmentDecision" } } },
          { name: "confidence_bps", type: "u16" },
          { name: "approved_bps", type: "u16" },
          { name: "rationale_hash", type: { array: ["u8", 32] } },
          { name: "summary", type: "string" },
          { name: "created_at", type: "i64" },
          { name: "bump", type: "u8" },
        ],
      },
    },
    {
      name: "DealStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "Draft" },
          { name: "Funded" },
          { name: "InProgress" },
          { name: "Completed" },
          { name: "Cancelled" },
        ],
      },
    },
    {
      name: "MilestoneStatus",
      type: {
        kind: "enum",
        variants: [
          { name: "PendingEvidence" },
          { name: "EvidenceSubmitted" },
          { name: "OnHold" },
          { name: "PaidFull" },
          { name: "Resolved" },
          { name: "Refunded" },
        ],
      },
    },
    {
      name: "AssessmentDecision",
      type: {
        kind: "enum",
        variants: [
          { name: "Approve" },
          { name: "Reject" },
          { name: "PartialApprove" },
        ],
      },
    },
  ],
} satisfies Idl;

export type MilestoneMindIdl = typeof milestoneMindIdl;
