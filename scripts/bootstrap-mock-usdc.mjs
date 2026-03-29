import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { web3 } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotent,
  createMint,
  mintTo,
} from "@solana/spl-token";

const MOCK_USDC_DECIMALS = 6;
const DEFAULT_RPC_URL = process.env.SOLANA_RPC_URL ?? "http://127.0.0.1:8899";
const DEFAULT_TOKEN_AMOUNT = BigInt(process.env.MOCK_USDC_AMOUNT ?? "1000000000");

function resolveHome(path) {
  if (!path) {
    return path;
  }

  if (path.startsWith("~/")) {
    return resolve(process.env.USERPROFILE ?? process.env.HOME ?? ".", path.slice(2));
  }

  return resolve(path);
}

function readKeypair(path) {
  const secretKey = JSON.parse(readFileSync(path, "utf8"));
  return web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function upsertEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const normalized = contents.trimEnd();
  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : normalized
      ? `${normalized}\n${line}\n`
      : `${line}\n`;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const walletPath = resolveHome(
  process.env.DEMO_CLIENT_KEYPAIR
    ?? process.env.ANCHOR_WALLET
    ?? process.env.SOLANA_WALLET
    ?? "~/.config/solana/id.json",
);
const envFile = resolve(
  repoRoot,
  process.env.MOCK_USDC_ENV_FILE
    ?? (DEFAULT_RPC_URL.includes("devnet") ? ".env.devnet" : ".env.localnet"),
);

const payer = readKeypair(walletPath);
const connection = new web3.Connection(DEFAULT_RPC_URL, "confirmed");

const mint = await createMint(
  connection,
  payer,
  payer.publicKey,
  null,
  MOCK_USDC_DECIMALS,
);
const clientAta = await createAssociatedTokenAccountIdempotent(
  connection,
  payer,
  mint,
  payer.publicKey,
);

await mintTo(connection, payer, mint, clientAta, payer, DEFAULT_TOKEN_AMOUNT);

let envContents = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
envContents = upsertEnvValue(envContents, "SOLANA_RPC_URL", DEFAULT_RPC_URL);
envContents = upsertEnvValue(envContents, "ANCHOR_WALLET", walletPath);
envContents = upsertEnvValue(envContents, "MOCK_USDC_MINT", mint.toBase58());
envContents = upsertEnvValue(envContents, "MOCK_USDC_CLIENT_ATA", clientAta.toBase58());
envContents = upsertEnvValue(envContents, "MOCK_USDC_DECIMALS", MOCK_USDC_DECIMALS.toString());
envContents = upsertEnvValue(
  envContents,
  "MOCK_USDC_BOOTSTRAP_AMOUNT",
  DEFAULT_TOKEN_AMOUNT.toString(),
);
writeFileSync(envFile, envContents, "utf8");

console.log(`RPC URL: ${DEFAULT_RPC_URL}`);
console.log(`Wallet: ${payer.publicKey.toBase58()}`);
console.log(`Mock USDC mint: ${mint.toBase58()}`);
console.log(`Client ATA: ${clientAta.toBase58()}`);
console.log(`Minted amount (base units): ${DEFAULT_TOKEN_AMOUNT.toString()}`);
console.log(`Saved environment to ${envFile}`);
