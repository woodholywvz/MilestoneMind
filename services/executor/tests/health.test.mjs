import assert from "node:assert/strict";
import test from "node:test";
import { PublicKey } from "@solana/web3.js";
import { createAppServer } from "../dist/server.js";

test("GET /health returns executor health payload", async () => {
  const server = createAppServer({
    config: {
      executorHost: "127.0.0.1",
      executorPort: 0,
      solanaRpcUrl: "http://127.0.0.1:8899",
      executorWalletPath: "C:/tmp/id.json",
      aiServiceBaseUrl: "http://127.0.0.1:8000",
      programId: new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x"),
    },
  });

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
});
