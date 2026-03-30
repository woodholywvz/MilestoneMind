export const EVIDENCE_HASH_BYTES = 32;

export interface EvidencePayload {
  evidenceUri: string;
  evidenceHash: Uint8Array;
  evidenceSummary: string;
  attachmentCount: number;
}

export function hexToEvidenceHash(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase().replace(/^0x/, "");

  if (normalized.length !== EVIDENCE_HASH_BYTES * 2) {
    throw new Error(`Evidence hash must be ${EVIDENCE_HASH_BYTES * 2} hex characters.`);
  }

  if (!/^[0-9a-f]+$/.test(normalized)) {
    throw new Error("Evidence hash contains non-hex characters.");
  }

  const bytes = new Uint8Array(EVIDENCE_HASH_BYTES);

  for (let index = 0; index < EVIDENCE_HASH_BYTES; index += 1) {
    const offset = index * 2;
    bytes[index] = Number.parseInt(normalized.slice(offset, offset + 2), 16);
  }

  return bytes;
}

export function evidenceHashToHex(hash: ArrayLike<number>): string {
  const bytes = Array.from(hash);

  if (bytes.length !== EVIDENCE_HASH_BYTES) {
    throw new Error(`Evidence hash must contain exactly ${EVIDENCE_HASH_BYTES} bytes.`);
  }

  return bytes
    .map((value) => {
      if (!Number.isInteger(value) || value < 0 || value > 255) {
        throw new Error("Evidence hash contains an invalid byte value.");
      }

      return value.toString(16).padStart(2, "0");
    })
    .join("");
}
