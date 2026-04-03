"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  UnsafeBurnerWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { getWebConfig } from "../lib/env";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const config = getWebConfig();
  const wallets = useMemo(() => {
    const nextWallets = [];

    if (config.cluster === "localnet") {
      nextWallets.push(new UnsafeBurnerWalletAdapter());
    }

    nextWallets.push(new PhantomWalletAdapter());

    if (config.cluster !== "localnet") {
      nextWallets.push(
        new SolflareWalletAdapter({
          network:
            config.cluster === "devnet"
              ? WalletAdapterNetwork.Devnet
              : config.cluster === "testnet"
                ? WalletAdapterNetwork.Testnet
                : WalletAdapterNetwork.Mainnet,
        }),
      );
    }

    return nextWallets;
  }, [config.cluster]);

  return (
    <ConnectionProvider endpoint={config.rpcUrl}>
      <WalletProvider autoConnect wallets={wallets}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
