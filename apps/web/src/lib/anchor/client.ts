import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { MilestoneMindIdl } from "@milestone-mind/shared/idl";
import {
  createMilestoneMindConnection,
  createMilestoneMindProgram,
  createMilestoneMindProgramId,
  ReadonlyMilestoneMindWallet,
} from "./program";

export function createReadonlyConnection(): Connection {
  return createMilestoneMindConnection();
}

export function createProgramId(): PublicKey {
  return createMilestoneMindProgramId();
}

export function createReadonlyProgram(): Program<MilestoneMindIdl> {
  return createMilestoneMindProgram(
    createReadonlyConnection(),
    new ReadonlyMilestoneMindWallet(),
  );
}
