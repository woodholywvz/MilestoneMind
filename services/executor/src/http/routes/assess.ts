import type { IncomingMessage, ServerResponse } from "node:http";
import {
  executorAssessCommitResponseSchema,
  executorAssessDryResponseSchema,
  executorAssessRequestSchema,
} from "@milestone-mind/shared";
import type { ExecutorConfig } from "../../env/config.js";
import {
  createRequestId,
  performCommitAssessment,
  performDryAssessment,
} from "../../lib/assessment.js";
import { logError, logInfo } from "../../lib/logger.js";
import { getRequestId, normalizeHttpError, readJsonBody, respondJson } from "../utils.js";

export interface AssessmentRouteDependencies {
  config: ExecutorConfig;
  performDryAssessment?: typeof performDryAssessment;
  performCommitAssessment?: typeof performCommitAssessment;
}

export async function handleDryAssessmentRoute(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: AssessmentRouteDependencies,
): Promise<void> {
  await handleAssessmentRoute({
    request,
    response,
    dependencies,
    mode: "dry",
    execute: (parsedBody, config, requestId) =>
      (dependencies.performDryAssessment ?? performDryAssessment)(parsedBody, {
        config,
        requestId,
      }),
  });
}

export async function handleCommitAssessmentRoute(
  request: IncomingMessage,
  response: ServerResponse,
  dependencies: AssessmentRouteDependencies,
): Promise<void> {
  await handleAssessmentRoute({
    request,
    response,
    dependencies,
    mode: "commit",
    execute: (parsedBody, config, requestId) =>
      (dependencies.performCommitAssessment ?? performCommitAssessment)(parsedBody, {
        config,
        requestId,
      }),
  });
}

async function handleAssessmentRoute(input: {
  request: IncomingMessage;
  response: ServerResponse;
  dependencies: AssessmentRouteDependencies;
  mode: "dry" | "commit";
  execute(
    parsedBody: ReturnType<typeof executorAssessRequestSchema.parse>,
    config: ExecutorConfig,
    requestId: string,
  ): Promise<unknown>;
}): Promise<void> {
  const requestId = getRequestId(input.request.headers["x-request-id"], createRequestId());

  try {
    const body = await readJsonBody(input.request);
    const parsedBody = executorAssessRequestSchema.parse(body);

    logInfo(
      {
        requestId,
        dealId: parsedBody.dealId,
        milestoneIndex: parsedBody.milestoneIndex,
      },
      `received HTTP ${input.mode} assessment request`,
    );

    const result = await input.execute(parsedBody, input.dependencies.config, requestId);
    const payload =
      input.mode === "dry"
        ? executorAssessDryResponseSchema.parse(result)
        : executorAssessCommitResponseSchema.parse(result);

    respondJson(input.response, 200, payload);
  } catch (error) {
    const normalizedError = normalizeHttpError(error);

    logError({ requestId }, `HTTP ${input.mode} assessment failed: ${normalizedError.message}`);
    respondJson(input.response, normalizedError.statusCode, {
      error: normalizedError.code,
      message: normalizedError.message,
    });
  }
}
