import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { web3 } from "@coral-xyz/anchor";

import {
  airdropLamports,
  defaultDemoEnvFile,
  detectRpcUrl,
  readEnvFile,
  readKeypair,
  repoRoot,
  upsertEnvValues,
  writeKeypair,
} from "./demo-utils.mjs";

const demoEnv = readEnvFile(defaultDemoEnvFile);
const walletDir = resolve(
  repoRoot,
  process.env.DEMO_WALLET_DIR ?? demoEnv.DEMO_WALLET_DIR ?? "demo-data/wallets",
);
const rpcUrl = detectRpcUrl(demoEnv);
const connection = new web3.Connection(rpcUrl, "confirmed");
const lamportsPerWallet = Number.parseInt(
  process.env.DEMO_WALLET_LAMPORTS ?? demoEnv.DEMO_WALLET_LAMPORTS ?? `${2 * web3.LAMPORTS_PER_SOL}`,
  10,
);
const walletSpecs = [
  ["DEMO_ADMIN_KEYPAIR", resolve(walletDir, "admin.json")],
  ["DEMO_CLIENT_KEYPAIR", resolve(walletDir, "client.json")],
  ["DEMO_FREELANCER_KEYPAIR", resolve(walletDir, "freelancer.json")],
  ["DEMO_ASSESSOR_KEYPAIR", resolve(walletDir, "assessor.json")],
];

const resolvedWallets = walletSpecs.map(([envKey, path]) => {
  if (!existsSync(path)) {
    writeKeypair(path, web3.Keypair.generate());
  }

  return { envKey, path, keypair: readKeypair(path) };
});

if (/127\.0\.0\.1|localhost/.test(rpcUrl)) {
  for (const wallet of resolvedWallets) {
    await airdropLamports(connection, wallet.keypair.publicKey, lamportsPerWallet);
  }
}

upsertEnvValues(defaultDemoEnvFile, {
  SOLANA_RPC_URL: rpcUrl,
  DEMO_WALLET_DIR: walletDir,
  DEMO_WALLET_LAMPORTS: lamportsPerWallet.toString(),
  DEMO_ADMIN_KEYPAIR: resolvedWallets[0].path,
  DEMO_CLIENT_KEYPAIR: resolvedWallets[1].path,
  DEMO_FREELANCER_KEYPAIR: resolvedWallets[2].path,
  DEMO_ASSESSOR_KEYPAIR: resolvedWallets[3].path,
  DEMO_ADMIN_PUBKEY: resolvedWallets[0].keypair.publicKey.toBase58(),
  DEMO_CLIENT_PUBKEY: resolvedWallets[1].keypair.publicKey.toBase58(),
  DEMO_FREELANCER_PUBKEY: resolvedWallets[2].keypair.publicKey.toBase58(),
  DEMO_ASSESSOR_PUBKEY: resolvedWallets[3].keypair.publicKey.toBase58(),
});

console.log(`RPC URL: ${rpcUrl}`);
console.log(`Demo env: ${defaultDemoEnvFile}`);
for (const wallet of resolvedWallets) {
  console.log(`${wallet.envKey}: ${wallet.path}`);
  console.log(`  pubkey: ${wallet.keypair.publicKey.toBase58()}`);
}
if (/127\.0\.0\.1|localhost/.test(rpcUrl)) {
  console.log(`Airdropped lamports per wallet: ${lamportsPerWallet}`);
}
