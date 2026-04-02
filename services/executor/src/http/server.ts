import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { HealthResponse } from "@milestone-mind/shared";
import { z } from "zod";
import type { ExecutorConfig } from "../env/config.js";
import { loadExecutorConfig } from "../env/config.js";
import { createRequestId, performDryAssessment } from "../lib/assessment.js";
import { ExecutorError, InvalidExecutorInputError } from "../lib/errors.js";
import { logError, logInfo } from "../lib/logger.js";

const dryAssessRequestSchema = z.object({
  dealId: z.number().int().nonnegative(),
  milestoneIndex: z.number().int().nonnegative(),
});

export function createAppServer(options: { config?: ExecutorConfig } = {}) {
  const config = options.config ?? loadExecutorConfig();

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/health") {
      const payload = {
        status: "ok",
        service: "executor",
      } satisfies HealthResponse;

      respondJson(response, 200, payload);
      return;
    }

    if (request.method === "POST" && url.pathname === "/assess/dry") {
      const requestId = getRequestId(request.headers["x-request-id"]);

      try {
        const body = await readJsonBody(request);
        const parsedBody = dryAssessRequestSchema.parse(body);

        logInfo(
          {
            requestId,
            dealId: parsedBody.dealId,
            milestoneIndex: parsedBody.milestoneIndex,
          },
          "received HTTP dry assessment request",
        );

        const result = await performDryAssessment(parsedBody, { config, requestId });

        respondJson(response, 200, result);
      } catch (error) {
        const normalizedError = normalizeHttpError(error);

        logError(
          { requestId },
          `HTTP dry assessment failed: ${normalizedError.message}`,
        );
        respondJson(response, normalizedError.statusCode, {
          error: normalizedError.code,
          message: normalizedError.message,
        });
      }

      return;
    }

    respondJson(response, 404, { error: "NOT_FOUND", message: "Not Found" });
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const text = Buffer.concat(chunks).toString("utf8");

  if (!text.trim()) {
    throw new InvalidExecutorInputError("Request body must not be empty.");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new InvalidExecutorInputError("Request body must be valid JSON.");
  }
}

function respondJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function getRequestId(headerValue: string | string[] | undefined): string {
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return createRequestId();
}

function normalizeHttpError(error: unknown): ExecutorError {
  if (error instanceof ExecutorError) {
    return error;
  }

  if (error instanceof z.ZodError) {
    return new InvalidExecutorInputError(error.issues.map((issue) => issue.message).join("; "));
  }

  if (error instanceof Error) {
    return new ExecutorError(error.message, "INTERNAL_ERROR", 500);
  }

  return new ExecutorError("Unknown executor error.", "INTERNAL_ERROR", 500);
}
