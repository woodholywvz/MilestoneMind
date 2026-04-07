import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  type Commitment,
  type Transaction,
  type VersionedTransaction,
} from "@solana/web3.js";
import { milestoneMindIdl, type MilestoneMindIdl } from "@milestone-mind/shared/idl";
import { getWebConfig } from "../env";

export type MilestoneMindWallet = Pick<
  Wallet,
  "publicKey" | "signTransaction" | "signAllTransactions"
>;

export class ReadonlyMilestoneMindWallet implements MilestoneMindWallet {
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

export function createMilestoneMindConnection(
  commitment: Commitment = "confirmed",
): Connection {
  return new Connection(getWebConfig().rpcUrl, commitment);
}

export function createMilestoneMindProgramId(): PublicKey {
  return new PublicKey(getWebConfig().programId);
}

export function createMilestoneMindProgram(
  connection: Connection,
  wallet: MilestoneMindWallet,
  commitment: Commitment = "confirmed",
): Program<MilestoneMindIdl> {
  const provider = new AnchorProvider(connection, wallet as Wallet, {
    commitment,
  });

  return new Program(
    {
      ...milestoneMindIdl,
      address: createMilestoneMindProgramId().toBase58(),
    },
    provider,
  );
}
