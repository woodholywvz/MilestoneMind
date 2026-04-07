import { z } from "zod";
import { assessResponseSchema } from "./assessment.js";
import { MilestoneStatus } from "./milestone-mind.js";

export const executorAssessRequestSchema = z.object({
  dealId: z.number().int().nonnegative(),
  milestoneIndex: z.number().int().nonnegative(),
});

export const executorAssessmentVerdictSchema = assessResponseSchema;

export const executorAssessDryResponseSchema = z.object({
  requestId: z.string().min(1),
  dealId: z.number().int().nonnegative(),
  milestoneIndex: z.number().int().nonnegative(),
  dealPubkey: z.string().min(32),
  milestonePubkey: z.string().min(32),
  assessmentPubkey: z.string().min(32),
  verdict: executorAssessmentVerdictSchema,
});

export const executorAssessCommitResponseSchema = executorAssessDryResponseSchema.extend({
  txSignature: z.string().min(1),
  milestoneStatus: z.nativeEnum(MilestoneStatus),
});

export const executorApiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
});

export type ExecutorAssessRequest = z.infer<typeof executorAssessRequestSchema>;
export type ExecutorAssessDryResponse = z.infer<typeof executorAssessDryResponseSchema>;
export type ExecutorAssessCommitResponse = z.infer<typeof executorAssessCommitResponseSchema>;
export type ExecutorApiError = z.infer<typeof executorApiErrorSchema>;
