import type { Program } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import type { MilestoneMindIdl } from "@milestone-mind/shared/idl";
import {
  deriveAssessmentPda,
  deriveMilestonePda,
  derivePlatformPda,
  deriveVaultAuthorityPda,
} from "../anchor/pdas";

type RemainingAccountMeta = {
  pubkey: PublicKey;
  isWritable: boolean;
  isSigner: boolean;
};

type DealActionMethods = {
  cancelDraftDeal(): {
    accounts(accounts: {
      client: PublicKey;
      deal: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
  releaseApprovedFunds(
    milestoneIndex: number,
  ): {
    accounts(accounts: {
      platform: PublicKey;
      deal: PublicKey;
      authority: PublicKey;
      milestone: PublicKey;
      assessment: PublicKey;
      mint: PublicKey;
      vaultAuthority: PublicKey;
      vaultTokenAccount: PublicKey;
      freelancer: PublicKey;
      freelancerTokenAccount: PublicKey;
      tokenProgram: PublicKey;
      associatedTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
  openDispute(
    milestoneIndex: number,
    reason: string,
  ): {
    accounts(accounts: {
      caller: PublicKey;
      deal: PublicKey;
      milestone: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
  resolveDispute(
    milestoneIndex: number,
    freelancerSplitBps: number,
  ): {
    accounts(accounts: {
      platform: PublicKey;
      deal: PublicKey;
      admin: PublicKey;
      milestone: PublicKey;
      mint: PublicKey;
      vaultAuthority: PublicKey;
      vaultTokenAccount: PublicKey;
      freelancer: PublicKey;
      freelancerTokenAccount: PublicKey;
      client: PublicKey;
      clientTokenAccount: PublicKey;
      tokenProgram: PublicKey;
      associatedTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
  finalizeDeal(): {
    accounts(accounts: {
      platform: PublicKey;
      client: PublicKey;
      deal: PublicKey;
      mint: PublicKey;
      vaultAuthority: PublicKey;
      vaultTokenAccount: PublicKey;
      clientTokenAccount: PublicKey;
      tokenProgram: PublicKey;
      associatedTokenProgram: PublicKey;
      systemProgram: PublicKey;
    }): {
      remainingAccounts(accounts: RemainingAccountMeta[]): {
        transaction(): Promise<Transaction>;
      };
    };
  };
};

export async function buildCancelDraftDealTransaction(input: {
  program: Program<MilestoneMindIdl>;
  client: PublicKey;
  deal: PublicKey;
}): Promise<Transaction> {
  return methods(input.program)
    .cancelDraftDeal()
    .accounts({
      client: input.client,
      deal: input.deal,
    })
    .transaction();
}

export async function buildReleaseApprovedFundsTransaction(input: {
  program: Program<MilestoneMindIdl>;
  authority: PublicKey;
  programId: PublicKey;
  deal: PublicKey;
  mint: PublicKey;
  freelancer: PublicKey;
  milestoneIndex: number;
}): Promise<Transaction> {
  const platform = derivePlatformPda(input.programId).publicKey;
  const milestone = deriveMilestonePda(input.deal, input.milestoneIndex, input.programId).publicKey;
  const assessment = deriveAssessmentPda(milestone, input.programId).publicKey;
  const vaultAuthority = deriveVaultAuthorityPda(input.deal, input.programId).publicKey;
  const vaultTokenAccount = getAssociatedTokenAddressSync(input.mint, vaultAuthority, true);
  const freelancerTokenAccount = getAssociatedTokenAddressSync(input.mint, input.freelancer);

  return methods(input.program)
    .releaseApprovedFunds(input.milestoneIndex)
    .accounts({
      platform,
      deal: input.deal,
      authority: input.authority,
      milestone,
      assessment,
      mint: input.mint,
      vaultAuthority,
      vaultTokenAccount,
      freelancer: input.freelancer,
      freelancerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildOpenDisputeTransaction(input: {
  program: Program<MilestoneMindIdl>;
  caller: PublicKey;
  programId: PublicKey;
  deal: PublicKey;
  milestoneIndex: number;
  reason: string;
}): Promise<Transaction> {
  const milestone = deriveMilestonePda(input.deal, input.milestoneIndex, input.programId).publicKey;

  return methods(input.program)
    .openDispute(input.milestoneIndex, input.reason)
    .accounts({
      caller: input.caller,
      deal: input.deal,
      milestone,
    })
    .transaction();
}

export async function buildResolveDisputeTransaction(input: {
  program: Program<MilestoneMindIdl>;
  admin: PublicKey;
  programId: PublicKey;
  deal: PublicKey;
  mint: PublicKey;
  freelancer: PublicKey;
  client: PublicKey;
  milestoneIndex: number;
  freelancerSplitBps: number;
}): Promise<Transaction> {
  const platform = derivePlatformPda(input.programId).publicKey;
  const milestone = deriveMilestonePda(input.deal, input.milestoneIndex, input.programId).publicKey;
  const vaultAuthority = deriveVaultAuthorityPda(input.deal, input.programId).publicKey;
  const vaultTokenAccount = getAssociatedTokenAddressSync(input.mint, vaultAuthority, true);
  const freelancerTokenAccount = getAssociatedTokenAddressSync(input.mint, input.freelancer);
  const clientTokenAccount = getAssociatedTokenAddressSync(input.mint, input.client);

  return methods(input.program)
    .resolveDispute(input.milestoneIndex, input.freelancerSplitBps)
    .accounts({
      platform,
      deal: input.deal,
      admin: input.admin,
      milestone,
      mint: input.mint,
      vaultAuthority,
      vaultTokenAccount,
      freelancer: input.freelancer,
      freelancerTokenAccount,
      client: input.client,
      clientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();
}

export async function buildFinalizeDealTransaction(input: {
  program: Program<MilestoneMindIdl>;
  client: PublicKey;
  programId: PublicKey;
  deal: PublicKey;
  mint: PublicKey;
  milestonePubkeys: string[];
}): Promise<Transaction> {
  const platform = derivePlatformPda(input.programId).publicKey;
  const vaultAuthority = deriveVaultAuthorityPda(input.deal, input.programId).publicKey;
  const vaultTokenAccount = getAssociatedTokenAddressSync(input.mint, vaultAuthority, true);
  const clientTokenAccount = getAssociatedTokenAddressSync(input.mint, input.client);

  return methods(input.program)
    .finalizeDeal()
    .accounts({
      platform,
      client: input.client,
      deal: input.deal,
      mint: input.mint,
      vaultAuthority,
      vaultTokenAccount,
      clientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(
      input.milestonePubkeys.map((pubkey) => ({
        pubkey: new PublicKey(pubkey),
        isWritable: false,
        isSigner: false,
      })),
    )
    .transaction();
}

function methods(program: Program<MilestoneMindIdl>): DealActionMethods {
  return program.methods as unknown as DealActionMethods;
}
