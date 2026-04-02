import process from "node:process";
import { PublicKey } from "@solana/web3.js";

export interface ExecutorConfig {
  executorHost: string;
  executorPort: number;
  solanaRpcUrl: string;
  executorWalletPath: string;
  aiServiceBaseUrl: string;
  programId: PublicKey;
}

const DEFAULT_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x";

export function loadExecutorConfig(env: NodeJS.ProcessEnv = process.env): ExecutorConfig {
  const executorHost = env.EXECUTOR_HOST ?? "0.0.0.0";
  const executorPort = parsePort(env.EXECUTOR_PORT ?? "8080", "EXECUTOR_PORT");
  const solanaRpcUrl = requireValue(
    env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899",
    "SOLANA_RPC_URL",
  );
  const executorWalletPath = requireValue(
    env.EXECUTOR_KEYPAIR_PATH ?? env.ANCHOR_WALLET,
    "EXECUTOR_KEYPAIR_PATH or ANCHOR_WALLET",
  );
  const aiServiceBaseUrl = normalizeBaseUrl(
    env.EXECUTOR_AI_BASE_URL ?? env.AI_SERVICE_BASE_URL ?? "http://127.0.0.1:8000",
  );
  const programId = new PublicKey(
    env.MILESTONE_MIND_PROGRAM_ID ?? DEFAULT_PROGRAM_ID,
  );

  return {
    executorHost,
    executorPort,
    solanaRpcUrl,
    executorWalletPath,
    aiServiceBaseUrl,
    programId,
  };
}

function parsePort(rawValue: string, name: string): number {
  const parsed = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${name} value: ${rawValue}`);
  }

  return parsed;
}

function requireValue(value: string | undefined, name: string): string {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value.trim();
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}
