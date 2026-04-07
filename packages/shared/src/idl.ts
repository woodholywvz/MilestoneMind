import type { Idl } from "@coral-xyz/anchor";

const DISCRIMINATORS = {
  initializePlatform: [119, 201, 101, 45, 75, 122, 89, 3],
  createDeal: [198, 212, 144, 151, 97, 56, 149, 113],
  createMilestone: [239, 58, 201, 28, 40, 186, 173, 48],
  fundDeal: [8, 26, 74, 169, 132, 56, 104, 60],
  submitAssessment: [7, 162, 212, 231, 150, 246, 85, 92],
  platformConfig: [160, 78, 128, 0, 248, 83, 230, 160],
  deal: [125, 223, 160, 234, 71, 162, 182, 219],
  milestone: [38, 210, 239, 177, 85, 184, 10, 44],
  assessment: [117, 114, 11, 171, 133, 118, 203, 33],
} as const;

export const milestoneMindIdl = {
  address: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x",
  metadata: {
    name: "milestone_mind",
    version: "0.1.0",
    spec: "0.1.0",
  },
  instructions: [
    {
      name: "initialize_platform",
      discriminator: [...DISCRIMINATORS.initializePlatform],
      accounts: [
        { name: "payer", writable: true, signer: true },
        { name: "platform", writable: true },
        { name: "system_program" },
      ],
      args: [
        { name: "admin", type: "pubkey" },
        { name: "assessor", type: "pubkey" },
        { name: "usdc_mint", type: "pubkey" },
      ],
    },
    {
      name: "create_deal",
      discriminator: [...DISCRIMINATORS.createDeal],
      accounts: [
        { name: "platform", writable: true },
        { name: "client", writable: true, signer: true },
        { name: "deal", writable: true },
        { name: "system_program" },
      ],
      args: [
        { name: "freelancer", type: "pubkey" },
        { name: "title", type: "string" },
        { name: "milestone_count", type: "u16" },
        { name: "total_amount", type: "u64" },
      ],
    },
    {
      name: "create_milestone",
      discriminator: [...DISCRIMINATORS.createMilestone],
      accounts: [
        { name: "client", writable: true, signer: true },
        { name: "deal" },
        { name: "milestone", writable: true },
        { name: "system_program" },
      ],
      args: [
        { name: "index", type: "u16" },
        { name: "title", type: "string" },
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "fund_deal",
      discriminator: [...DISCRIMINATORS.fundDeal],
      accounts: [
        { name: "platform" },
        { name: "client", writable: true, signer: true },
        { name: "deal", writable: true },
        { name: "mint" },
        { name: "vault_authority" },
        { name: "client_token_account", writable: true },
        { name: "vault_token_account", writable: true },
        { name: "token_program" },
        { name: "associated_token_program" },
        { name: "system_program" },
      ],
      args: [],
    },
    {
      name: "submit_assessment",
      discriminator: [...DISCRIMINATORS.submitAssessment],
      accounts: [
        { name: "platform" },
        { name: "assessor", writable: true, signer: true },
        { name: "deal", writable: true },
        { name: "milestone", writable: true },
        { name: "assessment", writable: true },
        { name: "system_program" },
      ],
      args: [
        { name: "milestone_index", type: "u16" },
        { name: "decision", type: { defined: { name: "AssessmentDecision" } } },
        { name: "confidence_bps", type: "u16" },
        { name: "approved_bps", type: "u16" },
        { name: "rationale_hash", type: { array: ["u8", 32] } },
        { name: "summary", type: "string" },
      ],
    },
  ],
  accounts: [
    {
      name: "PlatformConfig",
      discriminator: [...DISCRIMINATORS.platformConfig],
    },
    {
      name: "Deal",
      discriminator: [...DISCRIMINATORS.deal],
    },
    {
      name: "Milestone",
      discriminator: [...DISCRIMINATORS.milestone],
    },
    {
      name: "Assessment",
      discriminator: [...DISCRIMINATORS.assessment],
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
          { name: "Disputed" },
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
          { name: "Approved" },
          { name: "OnHold" },
          { name: "InDispute" },
          { name: "PaidPartial" },
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
          { name: "Hold" },
          { name: "Dispute" },
        ],
      },
    },
  ],
} satisfies Idl;

export type MilestoneMindIdl = typeof milestoneMindIdl;
