import assert from "node:assert/strict";
import { createAppServer } from "../dist/server.js";

async function main() {
  const server = createAppServer();

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });

  try {
    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Server did not bind to a TCP port.");
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { status: "ok", service: "executor" });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

await main();
