import { PublicKey, Connection } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotent,
  mintTo,
} from "@solana/spl-token";

import {
  defaultDemoEnvFile,
  detectRpcUrl,
  readEnvFile,
  readKeypair,
  upsertEnvValues,
} from "./demo-utils.mjs";

const demoEnv = readEnvFile(defaultDemoEnvFile);
const rpcUrl = detectRpcUrl(demoEnv);
const mintAddress = process.env.MOCK_USDC_MINT ?? demoEnv.MOCK_USDC_MINT;
const adminKeypairPath = process.env.DEMO_ADMIN_KEYPAIR ?? demoEnv.DEMO_ADMIN_KEYPAIR;
const clientKeypairPath = process.env.DEMO_CLIENT_KEYPAIR ?? demoEnv.DEMO_CLIENT_KEYPAIR;
const mintAmount = BigInt(
  process.env.DEMO_CLIENT_MOCK_USDC_AMOUNT
    ?? demoEnv.DEMO_CLIENT_MOCK_USDC_AMOUNT
    ?? "1000000000",
);

if (!mintAddress) {
  throw new Error("MOCK_USDC_MINT is required. Run demo:bootstrap-mint first.");
}
if (!adminKeypairPath) {
  throw new Error("DEMO_ADMIN_KEYPAIR is required. Run demo:create-wallets first.");
}
if (!clientKeypairPath) {
  throw new Error("DEMO_CLIENT_KEYPAIR is required. Run demo:create-wallets first.");
}

const connection = new Connection(rpcUrl, "confirmed");
const admin = readKeypair(adminKeypairPath);
const client = readKeypair(clientKeypairPath);
const mint = new PublicKey(mintAddress);
const clientAta = await createAssociatedTokenAccountIdempotent(
  connection,
  admin,
  mint,
  client.publicKey,
);

await mintTo(connection, admin, mint, clientAta, admin, mintAmount);

upsertEnvValues(defaultDemoEnvFile, {
  SOLANA_RPC_URL: rpcUrl,
  MOCK_USDC_MINT: mint.toBase58(),
  DEMO_CLIENT_ATA: clientAta.toBase58(),
  DEMO_CLIENT_MOCK_USDC_AMOUNT: mintAmount.toString(),
});

console.log(`RPC URL: ${rpcUrl}`);
console.log(`Mint: ${mint.toBase58()}`);
console.log(`Client wallet: ${client.publicKey.toBase58()}`);
console.log(`Client ATA: ${clientAta.toBase58()}`);
console.log(`Minted amount (base units): ${mintAmount.toString()}`);
