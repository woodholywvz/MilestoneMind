import { createServer } from "node:http";
import type { ExecutorConfig } from "../env/config.js";
import { loadExecutorConfig } from "../env/config.js";
import {
  handleCommitAssessmentRoute,
  handleDryAssessmentRoute,
  type AssessmentRouteDependencies,
} from "./routes/assess.js";
import { handleHealthRoute } from "./routes/health.js";
import { respondJson, respondNoContent } from "./utils.js";

export function createAppServer(
  options: { config?: ExecutorConfig } & Omit<AssessmentRouteDependencies, "config"> = {},
) {
  const config = options.config ?? loadExecutorConfig();
  const dependencies: AssessmentRouteDependencies = {
    config,
    performDryAssessment: options.performDryAssessment,
    performCommitAssessment: options.performCommitAssessment,
  };

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "OPTIONS") {
      respondNoContent(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      handleHealthRoute(response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/assess/dry") {
      await handleDryAssessmentRoute(request, response, dependencies);
      return;
    }

    if (request.method === "POST" && url.pathname === "/assess/commit") {
      await handleCommitAssessmentRoute(request, response, dependencies);
      return;
    }

    respondJson(response, 404, { error: "NOT_FOUND", message: "Not Found" });
  });
}
