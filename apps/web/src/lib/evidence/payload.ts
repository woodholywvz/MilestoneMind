import { MILESTONE_MIND_MAX_LENGTHS } from "@milestone-mind/shared";
import { normalizeEvidenceHashHex, parseEvidenceHashHex } from "./hash";

const MAX_ATTACHMENT_COUNT = 65_535;
const ATTACHMENT_COUNT_PATTERN = /^\d+$/;

export interface EvidenceSubmissionFormValues {
  evidenceUri: string;
  evidenceSummary: string;
  attachmentCountInput: string;
  hashHex: string;
}

export interface SerializedEvidenceSubmissionPayload {
  evidenceUri: string;
  evidenceSummary: string;
  attachmentCount: number;
  evidenceHashHex: string;
  evidenceHashBytes: number[];
}

export function serializeEvidenceSubmissionPayload(
  input: EvidenceSubmissionFormValues,
): SerializedEvidenceSubmissionPayload {
  const evidenceUri = input.evidenceUri.trim();
  const evidenceSummary = input.evidenceSummary.trim();
  const attachmentCount = parseAttachmentCountInput(input.attachmentCountInput);

  if (!evidenceUri) {
    throw new Error("Evidence URI is required.");
  }

  if (evidenceUri.length > MILESTONE_MIND_MAX_LENGTHS.evidenceUri) {
    throw new Error(
      `Evidence URI must be ${MILESTONE_MIND_MAX_LENGTHS.evidenceUri} characters or fewer.`,
    );
  }

  if (!evidenceSummary) {
    throw new Error("Evidence summary is required.");
  }

  if (evidenceSummary.length > MILESTONE_MIND_MAX_LENGTHS.evidenceSummary) {
    throw new Error(
      `Evidence summary must be ${MILESTONE_MIND_MAX_LENGTHS.evidenceSummary} characters or fewer.`,
    );
  }

  if (attachmentCount === null || attachmentCount <= 0) {
    throw new Error("Attachment count must be greater than zero.");
  }

  const evidenceHashHex = normalizeEvidenceHashHex(input.hashHex);
  const evidenceHashBytes = Array.from(parseEvidenceHashHex(evidenceHashHex));

  return {
    evidenceUri,
    evidenceSummary,
    attachmentCount,
    evidenceHashHex,
    evidenceHashBytes,
  };
}

export function parseAttachmentCountInput(value: string): number | null {
  const normalized = value.trim();

  if (!normalized || !ATTACHMENT_COUNT_PATTERN.test(normalized)) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);

  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > MAX_ATTACHMENT_COUNT) {
    return null;
  }

  return parsed;
}
