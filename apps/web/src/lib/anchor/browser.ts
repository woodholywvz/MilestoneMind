"use client";

import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import {
  createMilestoneMindProgram,
  createMilestoneMindProgramId,
  type MilestoneMindWallet,
} from "./program";

export function useMilestoneMindBrowserClient() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const programId = useMemo(() => createMilestoneMindProgramId(), []);
  const program = useMemo(
    () =>
      wallet
        ? createMilestoneMindProgram(connection, wallet as MilestoneMindWallet)
        : null,
    [connection, wallet],
  );

  return {
    connection,
    wallet,
    programId,
    program,
  };
}
