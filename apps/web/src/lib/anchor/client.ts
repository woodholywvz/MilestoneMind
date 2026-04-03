import "server-only";

import { AnchorProvider, Program } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { milestoneMindIdl, type MilestoneMindIdl } from "@milestone-mind/shared/idl";
import { getWebConfig } from "../env";

class ReadonlyWallet {
  readonly publicKey = PublicKey.default;

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
  ): Promise<T> {
    return transaction;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[],
  ): Promise<T[]> {
    return transactions;
  }
}

export function createReadonlyConnection(): Connection {
  return new Connection(getWebConfig().rpcUrl, "confirmed");
}

export function createProgramId(): PublicKey {
  return new PublicKey(getWebConfig().programId);
}

export function createReadonlyProgram(): Program<MilestoneMindIdl> {
  const connection = createReadonlyConnection();
  const provider = new AnchorProvider(connection, new ReadonlyWallet(), {
    commitment: "confirmed",
  });

  return new Program(
    {
      ...milestoneMindIdl,
      address: createProgramId().toBase58(),
    },
    provider,
  );
}
