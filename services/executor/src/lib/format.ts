import type { AssessResponse } from "@milestone-mind/shared";

export function renderDryAssessmentOutput(input: {
  requestId: string;
  dealId: number;
  milestoneIndex: number;
  dealPda: string;
  milestonePda: string;
  assessment: AssessResponse;
}): string {
  const lines = [
    "Assessment Dry Run",
    `requestId: ${input.requestId}`,
    `dealId: ${input.dealId}`,
    `milestoneIndex: ${input.milestoneIndex}`,
    `dealPda: ${input.dealPda}`,
    `milestonePda: ${input.milestonePda}`,
    `decision: ${input.assessment.decision}`,
    `confidenceBps: ${input.assessment.confidenceBps}`,
    `approvedBps: ${input.assessment.approvedBps}`,
    `summary: ${input.assessment.summary}`,
    `rationaleHashHex: ${input.assessment.rationaleHashHex}`,
    "ruleTrace:",
    ...input.assessment.ruleTrace.map((item, index) => `${index + 1}. ${item}`),
  ];

  return `${lines.join("\n")}\n`;
}
