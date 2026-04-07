import { BN, type Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction, type Connection } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { MilestoneMindIdl } from "@milestone-mind/shared/idl";
import type { PlatformConfigAccount } from "@milestone-mind/shared/onchain";
import { deriveDealPda, deriveMilestonePda, derivePlatformPda, deriveVaultAuthorityPda } from "../anchor/pdas";

export interface CreateMilestoneDraft {
  title: string;
  amount: bigint;
}

export interface PreparedCreateMilestone {
  index: number;
  title: string;
  amount: bigint;
  publicKey: PublicKey;
}

export interface PreparedCreateDealFlow {
  platformPda: PublicKey;
  dealId: bigint;
  dealPublicKey: PublicKey;
  vaultAuthorityPda: PublicKey;
  clientTokenAccount: PublicKey;
  vaultTokenAccount: PublicKey;
  mint: PublicKey;
  totalAmount: bigint;
  totalAmountBn: BN;
  milestones: PreparedCreateMilestone[];
}

type CreateFlowMethods = {
  createDeal(
    freelancer: PublicKey,
    title: string,
    milestoneCount: number,
    totalAmount: BN,
  ): {
    accounts(accounts: {
      platform: PublicKey;
      client: PublicKey;
      deal: PublicKey;
      systemProgram: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
  createMilestone(
    index: number,
    title: string,
    amount: BN,
  ): {
    accounts(accounts: {
      client: PublicKey;
      deal: PublicKey;
      milestone: PublicKey;
      systemProgram: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
  fundDeal(): {
    accounts(accounts: {
      platform: PublicKey;
      client: PublicKey;
      deal: PublicKey;
      mint: PublicKey;
      vaultAuthority: PublicKey;
      clientTokenAccount: PublicKey;
      vaultTokenAccount: PublicKey;
      tokenProgram: PublicKey;
      associatedTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
};

export function prepareCreateDealFlow(input: {
  programId: PublicKey;
  platform: PlatformConfigAccount;
  client: PublicKey;
  milestones: CreateMilestoneDraft[];
}): PreparedCreateDealFlow {
  const platformPda = derivePlatformPda(input.programId).publicKey;
  const dealId = BigInt(input.platform.nextDealId.toString());
  const dealPublicKey = deriveDealPda(dealId, input.programId).publicKey;
  const vaultAuthorityPda = deriveVaultAuthorityPda(dealPublicKey, input.programId).publicKey;
  const mint = input.platform.usdcMint;
  const clientTokenAccount = getAssociatedTokenAddressSync(mint, input.client);
  const vaultTokenAccount = getAssociatedTokenAddressSync(mint, vaultAuthorityPda, true);
  const milestones = input.milestones.map((milestone, index) => ({
    index,
    title: milestone.title,
    amount: milestone.amount,
    publicKey: deriveMilestonePda(dealPublicKey, index, input.programId).publicKey,
  }));
  const totalAmount = milestones.reduce((sum, milestone) => sum + milestone.amount, 0n);

  return {
    platformPda,
    dealId,
    dealPublicKey,
    vaultAuthorityPda,
    clientTokenAccount,
    vaultTokenAccount,
    mint,
    totalAmount,
    totalAmountBn: new BN(totalAmount.toString()),
    milestones,
  };
}

export async function buildCreateDealTransaction(input: {
  program: Program<MilestoneMindIdl>;
  client: PublicKey;
  freelancer: PublicKey;
  title: string;
  prepared: PreparedCreateDealFlow;
}): Promise<Transaction> {
  return methods(input.program)
    .createDeal(
      input.freelancer,
      input.title,
      input.prepared.milestones.length,
      input.prepared.totalAmountBn,
    )
    .accounts({
      platform: input.prepared.platformPda,
      client: input.client,
      deal: input.prepared.dealPublicKey,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildCreateMilestoneTransaction(input: {
  program: Program<MilestoneMindIdl>;
  client: PublicKey;
  dealPublicKey: PublicKey;
  milestone: PreparedCreateMilestone;
}): Promise<Transaction> {
  return methods(input.program)
    .createMilestone(
      input.milestone.index,
      input.milestone.title,
      new BN(input.milestone.amount.toString()),
    )
    .accounts({
      client: input.client,
      deal: input.dealPublicKey,
      milestone: input.milestone.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildFundDealTransaction(input: {
  program: Program<MilestoneMindIdl>;
  client: PublicKey;
  prepared: PreparedCreateDealFlow;
}): Promise<Transaction> {
  return methods(input.program)
    .fundDeal()
    .accounts({
      platform: input.prepared.platformPda,
      client: input.client,
      deal: input.prepared.dealPublicKey,
      mint: input.prepared.mint,
      vaultAuthority: input.prepared.vaultAuthorityPda,
      clientTokenAccount: input.prepared.clientTokenAccount,
      vaultTokenAccount: input.prepared.vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function sendAndConfirmWalletTransaction(input: {
  connection: Connection;
  wallet: WalletContextState;
  transaction: Transaction;
  feePayer: PublicKey;
}): Promise<string> {
  const latestBlockhash = await input.connection.getLatestBlockhash("confirmed");
  input.transaction.feePayer = input.feePayer;
  input.transaction.recentBlockhash = latestBlockhash.blockhash;

  const signature = await input.wallet.sendTransaction(input.transaction, input.connection, {
    skipPreflight: false,
    preflightCommitment: "confirmed",
  });

  await input.connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );

  return signature;
}

function methods(program: Program<MilestoneMindIdl>): CreateFlowMethods {
  return program.methods as unknown as CreateFlowMethods;
}
