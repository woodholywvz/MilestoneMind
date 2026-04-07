import type { AssessResponse } from "@milestone-mind/shared";

export function renderDryAssessmentOutput(input: {
  requestId: string;
  dealId: number;
  milestoneIndex: number;
  dealPubkey: string;
  milestonePubkey: string;
  verdict: AssessResponse;
}): string {
  const lines = [
    "Assessment Dry Run",
    `requestId: ${input.requestId}`,
    `dealId: ${input.dealId}`,
    `milestoneIndex: ${input.milestoneIndex}`,
    `dealPubkey: ${input.dealPubkey}`,
    `milestonePubkey: ${input.milestonePubkey}`,
    `decision: ${input.verdict.decision}`,
    `confidenceBps: ${input.verdict.confidenceBps}`,
    `approvedBps: ${input.verdict.approvedBps}`,
    `summary: ${input.verdict.summary}`,
    `rationaleHashHex: ${input.verdict.rationaleHashHex}`,
    "ruleTrace:",
    ...input.verdict.ruleTrace.map((item, index) => `${index + 1}. ${item}`),
  ];

  return `${lines.join("\n")}\n`;
}

export function renderCommitAssessmentOutput(input: {
  requestId: string;
  dealId: number;
  milestoneIndex: number;
  dealPubkey: string;
  milestonePubkey: string;
  txSignature: string;
  milestoneStatus: string;
  verdict: AssessResponse;
}): string {
  const lines = [
    "Assessment Commit",
    `requestId: ${input.requestId}`,
    `dealId: ${input.dealId}`,
    `milestoneIndex: ${input.milestoneIndex}`,
    `dealPubkey: ${input.dealPubkey}`,
    `milestonePubkey: ${input.milestonePubkey}`,
    `txSignature: ${input.txSignature}`,
    `milestoneStatus: ${input.milestoneStatus}`,
    `decision: ${input.verdict.decision}`,
    `confidenceBps: ${input.verdict.confidenceBps}`,
    `approvedBps: ${input.verdict.approvedBps}`,
    `summary: ${input.verdict.summary}`,
    `rationaleHashHex: ${input.verdict.rationaleHashHex}`,
    "ruleTrace:",
    ...input.verdict.ruleTrace.map((item, index) => `${index + 1}. ${item}`),
  ];

  return `${lines.join("\n")}\n`;
}
