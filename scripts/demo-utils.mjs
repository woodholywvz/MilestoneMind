import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { web3 } from "@coral-xyz/anchor";

const scriptDir = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(scriptDir, "..");
export const defaultDemoEnvFile = resolve(
  repoRoot,
  process.env.DEMO_ENV_FILE ?? ".env.demo.localnet",
);

export function resolveHome(path) {
  if (!path) {
    return path;
  }

  if (path.startsWith("~/")) {
    return resolve(process.env.USERPROFILE ?? process.env.HOME ?? ".", path.slice(2));
  }

  return resolve(path);
}

export function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
        return [key, value];
      }),
  );
}

export function upsertEnvValues(path, values) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = current.split(/\r?\n/).filter((line) => line.length > 0);
  const entries = new Map(
    lines
      .filter((line) => !line.trim().startsWith("#"))
      .map((line) => {
        const separatorIndex = line.indexOf("=");
        const key = separatorIndex >= 0 ? line.slice(0, separatorIndex) : line;
        const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1) : "";
        return [key, value];
      }),
  );

  for (const [key, value] of Object.entries(values)) {
    entries.set(key, value);
  }

  const nextContents = `${Array.from(entries.entries(), ([key, value]) => `${key}=${value}`).join("\n")}\n`;
  writeFileSync(path, nextContents, "utf8");
}

export function ensureParentDirectory(path) {
  mkdirSync(dirname(path), { recursive: true });
}

export function readKeypair(path) {
  const secretKey = JSON.parse(readFileSync(path, "utf8"));
  return web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

export function writeKeypair(path, keypair) {
  ensureParentDirectory(path);
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)), "utf8");
}

export async function airdropLamports(connection, recipient, lamports) {
  const signature = await connection.requestAirdrop(recipient, lamports);
  const latestBlockhash = await connection.getLatestBlockhash();

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
}

export function detectRpcUrl(demoEnv = {}) {
  return process.env.SOLANA_RPC_URL ?? demoEnv.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
}
