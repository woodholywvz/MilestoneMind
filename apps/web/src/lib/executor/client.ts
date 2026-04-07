import {
  executorApiErrorSchema,
  executorAssessCommitResponseSchema,
  executorAssessDryResponseSchema,
  executorAssessRequestSchema,
  type ExecutorAssessCommitResponse,
  type ExecutorAssessDryResponse,
  type ExecutorAssessRequest,
} from "@milestone-mind/shared";
import { getWebConfig } from "../env";

export class ExecutorApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "ExecutorApiError";
  }
}

export async function requestExecutorDryAssessment(
  input: ExecutorAssessRequest,
): Promise<ExecutorAssessDryResponse> {
  return callExecutorEndpoint("/assess/dry", input, executorAssessDryResponseSchema.parse);
}

export async function requestExecutorCommitAssessment(
  input: ExecutorAssessRequest,
): Promise<ExecutorAssessCommitResponse> {
  return callExecutorEndpoint("/assess/commit", input, executorAssessCommitResponseSchema.parse);
}

async function callExecutorEndpoint<T>(
  path: string,
  input: ExecutorAssessRequest,
  parseResponse: (payload: unknown) => T,
): Promise<T> {
  const body = executorAssessRequestSchema.parse(input);
  const response = await fetch(`${getWebConfig().executorBaseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const json = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const apiError = executorApiErrorSchema.safeParse(json);

    if (apiError.success) {
      throw new ExecutorApiError(
        apiError.data.message,
        apiError.data.error,
        response.status,
      );
    }

    throw new ExecutorApiError(
      `Executor responded with ${response.status}.`,
      "EXECUTOR_HTTP_ERROR",
      response.status,
    );
  }

  return parseResponse(json);
}
