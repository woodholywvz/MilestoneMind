import { PublicKey } from "@solana/web3.js";
import type { DerivedPda } from "@milestone-mind/shared/onchain";

const PLATFORM_SEED = Buffer.from("platform", "utf8");
const DEAL_SEED = Buffer.from("deal", "utf8");
const MILESTONE_SEED = Buffer.from("milestone", "utf8");
const ASSESSMENT_SEED = Buffer.from("assessment", "utf8");
const VAULT_SEED = Buffer.from("vault", "utf8");

export function derivePlatformPda(programId: PublicKey): DerivedPda {
  return findPda([PLATFORM_SEED], programId);
}

export function deriveDealPda(dealId: number | bigint, programId: PublicKey): DerivedPda {
  return findPda([DEAL_SEED, u64LeBuffer(dealId)], programId);
}

export function deriveMilestonePda(
  dealPublicKey: PublicKey,
  milestoneIndex: number,
  programId: PublicKey,
): DerivedPda {
  return findPda(
    [MILESTONE_SEED, dealPublicKey.toBuffer(), u16LeBuffer(milestoneIndex)],
    programId,
  );
}

export function deriveAssessmentPda(
  milestonePublicKey: PublicKey,
  programId: PublicKey,
): DerivedPda {
  return findPda([ASSESSMENT_SEED, milestonePublicKey.toBuffer()], programId);
}

export function deriveVaultAuthorityPda(
  dealPublicKey: PublicKey,
  programId: PublicKey,
): DerivedPda {
  return findPda([VAULT_SEED, dealPublicKey.toBuffer()], programId);
}

function findPda(seeds: Buffer[], programId: PublicKey): DerivedPda {
  const [publicKey, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey, bump };
}

function u64LeBuffer(value: number | bigint): Buffer {
  const normalized = typeof value === "bigint" ? value : BigInt(value);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(normalized);
  return buffer;
}

function u16LeBuffer(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}
