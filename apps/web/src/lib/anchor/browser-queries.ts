import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import type { Program } from "@coral-xyz/anchor";
import type { Connection, PublicKey } from "@solana/web3.js";
import type { MilestoneMindIdl } from "@milestone-mind/shared/idl";
import type { PlatformConfigAccount } from "@milestone-mind/shared/onchain";
import { derivePlatformPda } from "./pdas";

type AccountFetcher<T> = {
  fetch(address: PublicKey): Promise<T>;
};

export async function fetchPlatformConfigAccount(
  program: Program<MilestoneMindIdl>,
): Promise<{ publicKey: PublicKey; account: PlatformConfigAccount }> {
  const platformPublicKey = derivePlatformPda(program.programId).publicKey;
  const namespace = program.account as Record<string, AccountFetcher<PlatformConfigAccount>>;
  const platformClient = namespace.platformConfig;

  if (!platformClient) {
    throw new Error("PlatformConfig account client is unavailable in the current IDL.");
  }

  return {
    publicKey: platformPublicKey,
    account: await platformClient.fetch(platformPublicKey),
  };
}

export async function fetchWalletTokenBalance(input: {
  connection: Connection;
  mint: PublicKey;
  owner: PublicKey;
}): Promise<{ amount: bigint; tokenAccount: PublicKey | null }> {
  const tokenAccount = getAssociatedTokenAddressSync(input.mint, input.owner);
  const tokenAccountInfo = await input.connection.getAccountInfo(tokenAccount, "confirmed");

  if (tokenAccountInfo === null) {
    return {
      amount: 0n,
      tokenAccount: null,
    };
  }

  const balance = await input.connection.getTokenAccountBalance(tokenAccount, "confirmed");

  return {
    amount: BigInt(balance.value.amount),
    tokenAccount,
  };
}
