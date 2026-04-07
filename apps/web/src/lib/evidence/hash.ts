import {
  EVIDENCE_HASH_BYTES,
  evidenceHashToHex,
  hexToEvidenceHash,
} from "@milestone-mind/shared";

export const EVIDENCE_HASH_HEX_LENGTH = EVIDENCE_HASH_BYTES * 2;

export async function computeSha256Hex(file: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error("SHA-256 hashing is unavailable in this browser.");
  }

  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return formatEvidenceHashHex(new Uint8Array(digest));
}

export function parseEvidenceHashHex(value: string): Uint8Array {
  return hexToEvidenceHash(value);
}

export function formatEvidenceHashHex(value: ArrayLike<number>): string {
  return evidenceHashToHex(value);
}

export function normalizeEvidenceHashHex(value: string): string {
  return formatEvidenceHashHex(parseEvidenceHashHex(value));
}

export function formatEvidenceHashPreview(
  value: string,
  visibleChars = 8,
): string {
  const normalized = normalizeEvidenceHashHex(value);

  if (normalized.length <= visibleChars * 2) {
    return normalized;
  }

  return `${normalized.slice(0, visibleChars)}...${normalized.slice(-visibleChars)}`;
}

export function isZeroEvidenceHash(value: ArrayLike<number> | string): boolean {
  const normalized =
    typeof value === "string"
      ? value.trim().toLowerCase().replace(/^0x/, "")
      : formatEvidenceHashHex(value);

  return /^[0]+$/.test(normalized);
}
