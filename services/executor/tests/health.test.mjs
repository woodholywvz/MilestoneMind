import assert from "node:assert/strict";
import test from "node:test";
import {
  executorAssessCommitResponseSchema,
  executorAssessDryResponseSchema,
} from "@milestone-mind/shared";
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

test("POST /assess/dry returns the shared HTTP contract", async () => {
  const server = createAppServer({
    config: {
      executorHost: "127.0.0.1",
      executorPort: 0,
      solanaRpcUrl: "http://127.0.0.1:8899",
      executorWalletPath: "C:/tmp/id.json",
      aiServiceBaseUrl: "http://127.0.0.1:8000",
      programId: new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x"),
    },
    async performDryAssessment(input, dependencies) {
      assert.equal(input.dealId, 4);
      assert.equal(input.milestoneIndex, 2);
      assert.ok(dependencies.requestId);

      return {
        requestId: dependencies.requestId,
        dealId: input.dealId,
        milestoneIndex: input.milestoneIndex,
        dealPubkey: "Deal11111111111111111111111111111111111111111",
        milestonePubkey: "Mile1111111111111111111111111111111111111111",
        assessmentPubkey: "Assess1111111111111111111111111111111111111",
        verdict: {
          decision: "hold",
          confidenceBps: 6500,
          approvedBps: 0,
          summary: "Evidence needs another review pass.",
          rationaleHashHex: "cd".repeat(32),
          ruleTrace: ["engine: rules-v1", "decision: hold"],
          engineVersion: "rules-v1",
        },
      };
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

    const response = await fetch(`http://127.0.0.1:${address.port}/assess/dry`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ dealId: 4, milestoneIndex: 2 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    const parsed = executorAssessDryResponseSchema.parse(payload);
    assert.equal(parsed.verdict.decision, "hold");
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

test("POST /assess/commit returns tx signature and milestone status", async () => {
  const server = createAppServer({
    config: {
      executorHost: "127.0.0.1",
      executorPort: 0,
      solanaRpcUrl: "http://127.0.0.1:8899",
      executorWalletPath: "C:/tmp/id.json",
      aiServiceBaseUrl: "http://127.0.0.1:8000",
      programId: new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x"),
    },
    async performCommitAssessment(input, dependencies) {
      assert.equal(input.dealId, 9);
      assert.equal(input.milestoneIndex, 1);
      assert.ok(dependencies.requestId);

      return {
        requestId: dependencies.requestId,
        dealId: input.dealId,
        milestoneIndex: input.milestoneIndex,
        dealPubkey: "Deal11111111111111111111111111111111111111111",
        milestonePubkey: "Mile1111111111111111111111111111111111111111",
        assessmentPubkey: "Assess1111111111111111111111111111111111111",
        verdict: {
          decision: "approve",
          confidenceBps: 9100,
          approvedBps: 7000,
          summary: "Evidence supports a partial approval.",
          rationaleHashHex: "ab".repeat(32),
          ruleTrace: ["engine: rules-v1", "decision: approve"],
          engineVersion: "rules-v1",
        },
        txSignature: "mock-tx-signature-123",
        milestoneStatus: "approved",
      };
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

    const response = await fetch(`http://127.0.0.1:${address.port}/assess/commit`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ dealId: 9, milestoneIndex: 1 }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    const parsed = executorAssessCommitResponseSchema.parse(payload);
    assert.equal(parsed.txSignature, "mock-tx-signature-123");
    assert.equal(parsed.milestoneStatus, "approved");
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
