import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, SystemProgram, type PublicKey } from "@solana/web3.js";
import type { ExecutorConfig } from "../env/config.js";
import { loadKeypairFromPath } from "../env/wallet.js";
import type { AssessmentDecisionMirror } from "@milestone-mind/shared";
import type {
  AssessmentAccount,
  DealAccount,
  MilestoneAccount,
  PlatformConfigAccount,
} from "./types.js";
import { milestoneMindIdl, type MilestoneMindIdl } from "./idl.js";
import {
  deriveAssessmentPda,
  deriveDealPda,
  deriveMilestonePda,
  derivePlatformPda,
} from "./pdas.js";

type FetchableAccountClient = {
  fetch(address: PublicKey): Promise<unknown>;
  fetchNullable?(address: PublicKey): Promise<unknown | null>;
};

export class MilestoneMindAnchorClient {
  readonly connection: Connection;
  readonly provider: AnchorProvider;
  readonly program: Program<MilestoneMindIdl>;

  constructor(readonly config: ExecutorConfig) {
    const keypair = loadKeypairFromPath(config.executorWalletPath);
    const wallet = new Wallet(keypair);

    this.connection = new Connection(config.solanaRpcUrl, "confirmed");
    this.provider = new AnchorProvider(this.connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program(
      {
        ...milestoneMindIdl,
        address: config.programId.toBase58(),
      },
      this.provider,
    );
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  get walletPublicKey(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  async fetchPlatformConfig(address = derivePlatformPda(this.programId).publicKey) {
    return this.fetchAccount<PlatformConfigAccount>("platformConfig", address);
  }

  async fetchDeal(address: PublicKey) {
    return this.fetchAccount<DealAccount>("deal", address);
  }

  async fetchDealById(dealId: number) {
    const derived = deriveDealPda(dealId, this.programId);

    return {
      ...derived,
      account: await this.fetchDeal(derived.publicKey),
    };
  }

  async fetchMilestone(address: PublicKey) {
    return this.fetchAccount<MilestoneAccount>("milestone", address);
  }

  async fetchMilestoneByIndex(dealAddress: PublicKey, milestoneIndex: number) {
    const derived = deriveMilestonePda(dealAddress, milestoneIndex, this.programId);

    return {
      ...derived,
      account: await this.fetchMilestone(derived.publicKey),
    };
  }

  async fetchAssessmentByMilestone(milestoneAddress: PublicKey) {
    const derived = deriveAssessmentPda(milestoneAddress, this.programId);

    return {
      ...derived,
      account: await this.fetchNullableAccount<AssessmentAccount>(
        "assessment",
        derived.publicKey,
      ),
    };
  }

  async submitAssessment(input: {
    platform: PublicKey;
    deal: PublicKey;
    milestone: PublicKey;
    assessment: PublicKey;
    milestoneIndex: number;
    decision: AssessmentDecisionMirror;
    confidenceBps: number;
    approvedBps: number;
    rationaleHash: number[];
    summary: string;
  }): Promise<string> {
    const methods = this.program.methods as unknown as {
      submitAssessment(
        milestoneIndex: number,
        decision: AssessmentDecisionMirror,
        confidenceBps: number,
        approvedBps: number,
        rationaleHash: number[],
        summary: string,
      ): {
        accounts(accounts: {
          platform: PublicKey;
          assessor: PublicKey;
          deal: PublicKey;
          milestone: PublicKey;
          assessment: PublicKey;
          systemProgram: PublicKey;
        }): {
          rpc(): Promise<string>;
        };
      };
    };

    return methods
      .submitAssessment(
        input.milestoneIndex,
        input.decision,
        input.confidenceBps,
        input.approvedBps,
        input.rationaleHash,
        input.summary,
      )
      .accounts({
        platform: input.platform,
        assessor: this.walletPublicKey,
        deal: input.deal,
        milestone: input.milestone,
        assessment: input.assessment,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  private async fetchAccount<T>(name: string, address: PublicKey): Promise<T> {
    const account = await this.fetchNullableAccount<T>(name, address);

    if (account === null) {
      throw new Error(`Account ${name} was not found at ${address.toBase58()}.`);
    }

    return account;
  }

  private async fetchNullableAccount<T>(
    name: string,
    address: PublicKey,
  ): Promise<T | null> {
    const namespace = this.program.account as Record<string, FetchableAccountClient>;
    const accountClient = namespace[name];

    if (!accountClient) {
      throw new Error(`Anchor account namespace is missing client for ${name}.`);
    }

    if (typeof accountClient.fetchNullable === "function") {
      const result = await accountClient.fetchNullable(address);
      return (result as T | null) ?? null;
    }

    try {
      const result = await accountClient.fetch(address);
      return result as T;
    } catch (error) {
      if (error instanceof Error && /does not exist|no data/i.test(error.message)) {
        return null;
      }

      throw error;
    }
  }
}
