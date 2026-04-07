import { getWebConfig } from "./env";

export function buildExplorerAccountUrl(address: string): string {
  return `https://explorer.solana.com/address/${address}${buildClusterQuery()}`;
}

export function buildExplorerTransactionUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${buildClusterQuery()}`;
}

function buildClusterQuery(): string {
  const config = getWebConfig();

  if (config.cluster === "localnet") {
    return `?cluster=custom&customUrl=${encodeURIComponent(config.rpcUrl)}`;
  }

  if (config.cluster === "mainnet-beta") {
    return "";
  }

  return `?cluster=${config.cluster}`;
}
