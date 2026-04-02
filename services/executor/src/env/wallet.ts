import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { Keypair } from "@solana/web3.js";

export function loadKeypairFromPath(walletPath: string): Keypair {
  const resolvedPath = expandHomeDirectory(walletPath);
  const fileContent = readFileSync(resolvedPath, "utf8");
  const secret = JSON.parse(fileContent) as unknown;

  if (!Array.isArray(secret) || secret.some((value) => !Number.isInteger(value))) {
    throw new Error(`Wallet file at ${resolvedPath} does not contain a valid secret key array.`);
  }

  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

function expandHomeDirectory(inputPath: string): string {
  if (inputPath.startsWith("~/") || inputPath.startsWith("~\\")) {
    return resolve(homedir(), inputPath.slice(2));
  }

  return resolve(inputPath);
}
