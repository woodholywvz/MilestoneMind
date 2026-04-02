import type { AssessRequest } from "@milestone-mind/shared";
import { AiServiceError } from "./errors.js";
import { parseAiAssessmentResponse } from "./payload.js";

export interface RequestAiAssessmentOptions {
  baseUrl: string;
  requestId: string;
}

export async function requestAiAssessment(
  payload: AssessRequest,
  options: RequestAiAssessmentOptions,
) {
  const response = await fetch(`${options.baseUrl}/assess`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-request-id": options.requestId,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const bodyText = await response.text();

    throw new AiServiceError(
      `AI service responded with ${response.status}: ${bodyText || response.statusText}`,
    );
  }

  const json = (await response.json()) as unknown;
  return parseAiAssessmentResponse(json);
}
