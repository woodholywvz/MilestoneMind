import { z } from "zod";

export const assessmentDecisionSchema = z.enum(["approve", "hold", "dispute"]);

export const assessRequestSchema = z.object({
  dealPubkey: z.string(),
  milestonePubkey: z.string(),
  milestoneIndex: z.number().int().nonnegative(),
  dealTitle: z.string(),
  milestoneTitle: z.string(),
  milestoneAmount: z.number().nonnegative(),
  evidenceUri: z.string(),
  evidenceHashHex: z.string(),
  evidenceSummary: z.string(),
  attachmentCount: z.number().int().nonnegative(),
});

export const assessResponseSchema = z.object({
  decision: assessmentDecisionSchema,
  confidenceBps: z.number().int().min(0).max(10_000),
  approvedBps: z.number().int().min(0).max(10_000),
  summary: z.string(),
  rationaleHashHex: z.string().regex(/^[0-9a-f]{64}$/i),
  ruleTrace: z.array(z.string()),
  engineVersion: z.string(),
});

export type AssessRequest = z.infer<typeof assessRequestSchema>;
export type AssessResponse = z.infer<typeof assessResponseSchema>;
export type AssessmentDecision = z.infer<typeof assessmentDecisionSchema>;
