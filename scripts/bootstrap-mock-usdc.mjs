import { web3 } from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotent,
  createMint,
  mintTo,
} from "@solana/spl-token";
import { existsSync } from "node:fs";

import {
  defaultDemoEnvFile,
  detectRpcUrl,
  readEnvFile,
  readKeypair,
  repoRoot,
  resolveHome,
  upsertEnvValues,
} from "./demo-utils.mjs";

const MOCK_USDC_DECIMALS = 6;
const demoEnv = readEnvFile(defaultDemoEnvFile);
const DEFAULT_RPC_URL = detectRpcUrl(demoEnv);
const DEFAULT_TOKEN_AMOUNT = BigInt(process.env.MOCK_USDC_AMOUNT ?? "1000000000");
const walletPath = resolveHome(
  process.env.DEMO_MINT_AUTHORITY_KEYPAIR
    ?? process.env.DEMO_ADMIN_KEYPAIR
    ?? demoEnv.DEMO_ADMIN_KEYPAIR
    ?? process.env.DEMO_CLIENT_KEYPAIR
    ?? process.env.ANCHOR_WALLET
    ?? process.env.SOLANA_WALLET
    ?? "~/.config/solana/id.json",
);
const defaultEnvFile =
  existsSync(defaultDemoEnvFile)
    ? defaultDemoEnvFile
    : resolveHome(
        process.env.MOCK_USDC_ENV_FILE
          ?? (DEFAULT_RPC_URL.includes("devnet") ? `${repoRoot}\\.env.devnet` : `${repoRoot}\\.env.localnet`),
      );
const envFile = process.env.MOCK_USDC_ENV_FILE
  ? resolveHome(process.env.MOCK_USDC_ENV_FILE)
  : defaultEnvFile;

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

upsertEnvValues(envFile, {
  SOLANA_RPC_URL: DEFAULT_RPC_URL,
  ANCHOR_WALLET: walletPath,
  MOCK_USDC_MINT: mint.toBase58(),
  MOCK_USDC_CLIENT_ATA: clientAta.toBase58(),
  MOCK_USDC_DECIMALS: MOCK_USDC_DECIMALS.toString(),
  MOCK_USDC_BOOTSTRAP_AMOUNT: DEFAULT_TOKEN_AMOUNT.toString(),
});

console.log(`RPC URL: ${DEFAULT_RPC_URL}`);
console.log(`Wallet: ${payer.publicKey.toBase58()}`);
console.log(`Mock USDC mint: ${mint.toBase58()}`);
console.log(`Bootstrap ATA: ${clientAta.toBase58()}`);
console.log(`Minted amount (base units): ${DEFAULT_TOKEN_AMOUNT.toString()}`);
console.log(`Saved environment to ${envFile}`);
