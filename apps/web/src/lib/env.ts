export type WebCluster = "localnet" | "devnet" | "testnet" | "mainnet-beta";

export interface WebConfig {
  rpcUrl: string;
  programId: string;
  cluster: WebCluster;
}

const DEFAULT_RPC_URL = "http://127.0.0.1:8899";
const DEFAULT_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x";

export function getWebConfig(): WebConfig {
  return {
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? DEFAULT_RPC_URL,
    programId: process.env.NEXT_PUBLIC_PROGRAM_ID ?? DEFAULT_PROGRAM_ID,
    cluster: normalizeCluster(process.env.NEXT_PUBLIC_CLUSTER),
  };
}

function normalizeCluster(value: string | undefined): WebCluster {
  switch (value) {
    case "devnet":
    case "testnet":
    case "mainnet-beta":
    case "localnet":
      return value;
    default:
      return "localnet";
  }
}
