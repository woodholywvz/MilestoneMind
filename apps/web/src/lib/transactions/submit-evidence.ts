import type { Program } from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import type { MilestoneMindIdl } from "@milestone-mind/shared/idl";
import type { SerializedEvidenceSubmissionPayload } from "../evidence/payload";

type SubmitEvidenceMethods = {
  submitEvidence(
    milestoneIndex: number,
    evidenceUri: string,
    evidenceHash: number[],
    evidenceSummary: string,
    attachmentCount: number,
  ): {
    accounts(accounts: {
      freelancer: PublicKey;
      deal: PublicKey;
      milestone: PublicKey;
    }): {
      transaction(): Promise<Transaction>;
    };
  };
};

export async function buildSubmitEvidenceTransaction(input: {
  program: Program<MilestoneMindIdl>;
  freelancer: PublicKey;
  deal: PublicKey;
  milestone: PublicKey;
  milestoneIndex: number;
  payload: SerializedEvidenceSubmissionPayload;
}): Promise<Transaction> {
  return methods(input.program)
    .submitEvidence(
      input.milestoneIndex,
      input.payload.evidenceUri,
      input.payload.evidenceHashBytes,
      input.payload.evidenceSummary,
      input.payload.attachmentCount,
    )
    .accounts({
      freelancer: input.freelancer,
      deal: input.deal,
      milestone: input.milestone,
    })
    .transaction();
}

function methods(program: Program<MilestoneMindIdl>): SubmitEvidenceMethods {
  return program.methods as unknown as SubmitEvidenceMethods;
}
