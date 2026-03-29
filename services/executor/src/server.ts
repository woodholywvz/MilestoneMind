import { createServer } from "node:http";
import type { HealthResponse } from "@milestone-mind/shared";

export function createAppServer() {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      const payload = {
        status: "ok",
        service: "executor"
      } satisfies HealthResponse;

      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(payload));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: "Not Found" }));
  });
}
