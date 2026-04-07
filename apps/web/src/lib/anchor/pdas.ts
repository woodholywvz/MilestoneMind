import { PublicKey } from "@solana/web3.js";
import type { DerivedPda } from "@milestone-mind/shared/onchain";

const textEncoder = new TextEncoder();
const PLATFORM_SEED = textEncoder.encode("platform");
const DEAL_SEED = textEncoder.encode("deal");
const MILESTONE_SEED = textEncoder.encode("milestone");
const ASSESSMENT_SEED = textEncoder.encode("assessment");
const VAULT_SEED = textEncoder.encode("vault");

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

function findPda(seeds: Uint8Array[], programId: PublicKey): DerivedPda {
  const [publicKey, bump] = PublicKey.findProgramAddressSync(seeds, programId);
  return { publicKey, bump };
}

function u64LeBuffer(value: number | bigint): Uint8Array {
  const normalized = typeof value === "bigint" ? value : BigInt(value);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setBigUint64(0, normalized, true);
  return new Uint8Array(buffer);
}

function u16LeBuffer(value: number): Uint8Array {
  const buffer = new ArrayBuffer(2);
  const view = new DataView(buffer);
  view.setUint16(0, value, true);
  return new Uint8Array(buffer);
}
