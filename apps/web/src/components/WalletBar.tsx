"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { getWebConfig } from "../lib/env";
import { formatPubkey } from "../lib/formatters";

export function WalletBar() {
  const config = getWebConfig();
  const { publicKey, wallet } = useWallet();

  return (
    <div className="wallet-bar">
      <div>
        <p className="section-eyebrow">Wallet</p>
        <h2 className="wallet-title">Read-only dashboard</h2>
      </div>
      <div className="wallet-meta">
        <span className="cluster-pill">{config.cluster}</span>
        <span className="rpc-pill">{config.rpcUrl}</span>
        {publicKey ? (
          <span className="wallet-pill">
            {wallet?.adapter.name ?? "Connected"} {formatPubkey(publicKey.toBase58(), 5)}
          </span>
        ) : (
          <span className="wallet-pill wallet-pill-muted">No wallet connected</span>
        )}
      </div>
      <WalletMultiButton className="wallet-button" />
    </div>
  );
}
