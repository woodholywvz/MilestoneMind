import type { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { ExecutorError, InvalidExecutorInputError } from "../lib/errors.js";

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
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

export function respondJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-request-id",
  });
  response.end(JSON.stringify(payload));
}

export function respondNoContent(response: ServerResponse, statusCode = 204): void {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,x-request-id",
  });
  response.end();
}

export function normalizeHttpError(error: unknown): ExecutorError {
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

export function getRequestId(headerValue: string | string[] | undefined, fallback: string): string {
  if (typeof headerValue === "string" && headerValue.trim()) {
    return headerValue.trim();
  }

  return fallback;
}
