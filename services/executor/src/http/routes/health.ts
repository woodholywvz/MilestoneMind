import type { ServerResponse } from "node:http";
import type { HealthResponse } from "@milestone-mind/shared";
import { respondJson } from "../utils.js";

export function handleHealthRoute(response: ServerResponse): void {
  const payload = {
    status: "ok",
    service: "executor",
  } satisfies HealthResponse;

  respondJson(response, 200, payload);
}
