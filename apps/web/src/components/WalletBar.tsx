"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { getWebConfig } from "../lib/env";
import { formatPubkey } from "../lib/formatters";

export function WalletBar() {
  const config = getWebConfig();
  const { publicKey, wallet } = useWallet();
  const pathname = usePathname();

  return (
    <div className="wallet-bar">
      <div className="wallet-bar-top">
        <div>
          <p className="section-eyebrow">Wallet</p>
          <h2 className="wallet-title">On-chain dashboard</h2>
        </div>
        <nav className="wallet-nav">
          <Link className={navClassName(pathname, "/")} href="/">
            Dashboard
          </Link>
          <Link className={navClassName(pathname, "/create")} href="/create">
            Create Deal
          </Link>
        </nav>
      </div>
      <div>
        <p className="section-eyebrow">Wallet</p>
        <h2 className="wallet-title">Connected session</h2>
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

function navClassName(pathname: string, href: string): string {
  return pathname === href ? "nav-link nav-link-active" : "nav-link";
}
