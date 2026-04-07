import assert from "node:assert/strict";
import test from "node:test";
import anchor from "@coral-xyz/anchor";
import { executorAssessCommitResponseSchema, executorAssessDryResponseSchema } from "@milestone-mind/shared";
import { PublicKey } from "@solana/web3.js";
import { deriveDealPda } from "../dist/anchor/pdas.js";
import { buildAssessRequest, parseAiAssessmentResponse } from "../dist/lib/payload.js";
import {
  performCommitAssessment,
  performDryAssessment,
} from "../dist/lib/assessment.js";

const { BN } = anchor;

function dealStatus(key) {
  return { [key]: {} };
}

function milestoneStatus(key) {
  return { [key]: {} };
}

function buildDeal() {
  return {
    dealId: new BN(0),
    client: new PublicKey("11111111111111111111111111111111"),
    freelancer: new PublicKey("11111111111111111111111111111111"),
    mint: new PublicKey("11111111111111111111111111111111"),
    totalAmount: new BN(7_000_000),
    fundedAmount: new BN(7_000_000),
    milestoneCount: 1,
    settledMilestones: 0,
    status: dealStatus("inProgress"),
    title: "Production landing page rollout",
    createdAt: new BN(1_712_345_678),
    bump: 255,
  };
}

function buildMilestone(status = "evidenceSubmitted") {
  return {
    deal: new PublicKey("11111111111111111111111111111111"),
    index: 0,
    title: "Finalize deployment and acceptance package",
    amount: new BN(7_000_000),
    releasedAmount: new BN(0),
    status: milestoneStatus(status),
    evidenceUri: "ipfs://milestonemind/final-package-v1",
    evidenceHash: new Uint8Array(32).fill(171),
    evidenceSummary:
      "Final delivered production package accepted by the client with screenshots and invoice.",
    attachmentCount: 3,
    lastSubmittedAt: new BN(1_712_345_679),
    bump: 254,
  };
}

test("schema validation test builds a shared assess request", () => {
  const dealPublicKey = new PublicKey("11111111111111111111111111111111");
  const milestonePublicKey = new PublicKey("11111111111111111111111111111111");
  const payload = buildAssessRequest({
    dealPublicKey,
    milestonePublicKey,
    deal: buildDeal(),
    milestone: buildMilestone(),
  });

  assert.equal(payload.dealPubkey, dealPublicKey.toBase58());
  assert.equal(payload.milestonePubkey, milestonePublicKey.toBase58());
  assert.equal(payload.milestoneAmount, 7_000_000);
  assert.equal(payload.attachmentCount, 3);
  assert.match(payload.evidenceHashHex, /^[0-9a-f]{64}$/);
});

test("payload mapping test preserves evidence fields", () => {
  const payload = buildAssessRequest({
    dealPublicKey: new PublicKey("11111111111111111111111111111111"),
    milestonePublicKey: new PublicKey("11111111111111111111111111111111"),
    deal: buildDeal(),
    milestone: buildMilestone(),
  });

  assert.equal(payload.dealTitle, "Production landing page rollout");
  assert.equal(payload.milestoneTitle, "Finalize deployment and acceptance package");
  assert.equal(payload.evidenceUri, "ipfs://milestonemind/final-package-v1");
  assert.match(payload.evidenceSummary, /Final delivered production package accepted/);
});

test("executor refuses non-EvidenceSubmitted milestone", async () => {
  let aiInvoked = false;
  const programId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x");
  const dealPublicKey = deriveDealPda(0, programId).publicKey;

  await assert.rejects(
    () =>
      performDryAssessment(
        { dealId: 0, milestoneIndex: 0 },
        {
          config: {
            executorHost: "127.0.0.1",
            executorPort: 8080,
            solanaRpcUrl: "http://127.0.0.1:8899",
            executorWalletPath: "C:/tmp/id.json",
            aiServiceBaseUrl: "http://127.0.0.1:8000",
            programId,
          },
          anchorClient: {
            programId,
            async fetchDeal(address) {
              assert.equal(address.toBase58().length > 0, true);
              return { ...buildDeal(), client: dealPublicKey };
            },
            async fetchMilestone() {
              return { ...buildMilestone("pendingEvidence"), deal: dealPublicKey };
            },
          },
          async requestAiAssessment() {
            aiInvoked = true;
            throw new Error("AI should not be called");
          },
        },
      ),
    /EvidenceSubmitted status/i,
  );

  assert.equal(aiInvoked, false);
});

test("mock AI response parsing test", () => {
  const response = parseAiAssessmentResponse({
    decision: "approve",
    confidenceBps: 9100,
    approvedBps: 7000,
    summary: "Evidence is credible and sufficient for a partial approval.",
    rationaleHashHex: "ab".repeat(32),
    ruleTrace: ["engine: rules-v1", "decision: approve"],
    engineVersion: "rules-v1+openai-v1",
  });

  assert.equal(response.decision, "approve");
  assert.equal(response.approvedBps, 7000);
  assert.equal(response.ruleTrace.length, 2);
});

test("commit mode submits on-chain assessment and returns the final milestone status", async () => {
  const programId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x");
  const assessor = new PublicKey("HfN7bL6J6Ex35tqZQxwcN8B4p5szY5n1yYqKqRR3YKHy");
  const dealPublicKey = deriveDealPda(0, programId).publicKey;
  let milestoneFetchCount = 0;
  let submittedDecisionKey = null;

  const result = await performCommitAssessment(
    { dealId: 0, milestoneIndex: 0 },
    {
      config: {
        executorHost: "127.0.0.1",
        executorPort: 8080,
        solanaRpcUrl: "http://127.0.0.1:8899",
        executorWalletPath: "C:/tmp/id.json",
        aiServiceBaseUrl: "http://127.0.0.1:8000",
        programId,
      },
      anchorClient: {
        programId,
        walletPublicKey: assessor,
        async fetchPlatformConfig() {
          return {
            admin: assessor,
            assessor,
            usdcMint: assessor,
            nextDealId: new BN(1),
            bump: 255,
          };
        },
        async fetchDeal() {
          return { ...buildDeal(), status: dealStatus("inProgress"), client: dealPublicKey };
        },
        async fetchMilestone() {
          milestoneFetchCount += 1;
          if (milestoneFetchCount === 1) {
            return { ...buildMilestone("evidenceSubmitted"), deal: dealPublicKey };
          }

          return { ...buildMilestone("approved"), deal: dealPublicKey };
        },
        async submitAssessment(args) {
          submittedDecisionKey = Object.keys(args.decision)[0];
          assert.equal(args.confidenceBps, 9100);
          assert.equal(args.approvedBps, 7000);
          assert.equal(args.summary, "Evidence is credible and sufficient for a partial approval.");
          assert.equal(args.rationaleHash.length, 32);
          return "mock-signature-123";
        },
      },
      async requestAiAssessment() {
        return {
          decision: "approve",
          confidenceBps: 9100,
          approvedBps: 7000,
          summary: "Evidence is credible and sufficient for a partial approval.",
          rationaleHashHex: "ab".repeat(32),
          ruleTrace: ["engine: rules-v1", "decision: approve"],
          engineVersion: "rules-v1+openai-v1",
        };
      },
    },
  );

  assert.equal(submittedDecisionKey, "approve");
  executorAssessCommitResponseSchema.parse(result);
  assert.equal(result.txSignature, "mock-signature-123");
  assert.equal(result.milestoneStatus, "approved");
  assert.equal(result.verdict.decision, "approve");
});

test("dry assessment result matches shared executor response schema", async () => {
  const programId = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x");
  const dealPublicKey = deriveDealPda(0, programId).publicKey;

  const result = await performDryAssessment(
    { dealId: 0, milestoneIndex: 0 },
    {
      config: {
        executorHost: "127.0.0.1",
        executorPort: 8080,
        solanaRpcUrl: "http://127.0.0.1:8899",
        executorWalletPath: "C:/tmp/id.json",
        aiServiceBaseUrl: "http://127.0.0.1:8000",
        programId,
      },
      anchorClient: {
        programId,
        async fetchDeal() {
          return { ...buildDeal(), client: dealPublicKey };
        },
        async fetchMilestone() {
          return { ...buildMilestone("evidenceSubmitted"), deal: dealPublicKey };
        },
      },
      async requestAiAssessment() {
        return {
          decision: "approve",
          confidenceBps: 9100,
          approvedBps: 7000,
          summary: "Evidence is credible and sufficient for a partial approval.",
          rationaleHashHex: "ab".repeat(32),
          ruleTrace: ["engine: rules-v1", "decision: approve"],
          engineVersion: "rules-v1+openai-v1",
        };
      },
    },
  );

  executorAssessDryResponseSchema.parse(result);
  assert.equal(result.dealPubkey, dealPublicKey.toBase58());
  assert.equal(result.verdict.decision, "approve");
});
