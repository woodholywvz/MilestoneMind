"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  DealStatus,
  MILESTONE_MIND_MAX_LENGTHS,
  MilestoneStatus,
} from "@milestone-mind/shared";
import { useMilestoneMindBrowserClient } from "../lib/anchor/browser";
import { buildExplorerTransactionUrl } from "../lib/explorer";
import { formatPubkey, type StatusTone } from "../lib/formatters";
import {
  computeSha256Hex,
  formatEvidenceHashPreview,
  isZeroEvidenceHash,
  normalizeEvidenceHashHex,
} from "../lib/evidence/hash";
import {
  parseAttachmentCountInput,
  serializeEvidenceSubmissionPayload,
} from "../lib/evidence/payload";
import { sendAndConfirmWalletTransaction } from "../lib/transactions/create-deal";
import { buildSubmitEvidenceTransaction } from "../lib/transactions/submit-evidence";

interface EvidenceSubmissionCardProps {
  dealPubkey: string;
  dealStatusValue: DealStatus;
  freelancerPubkey: string;
  milestone: {
    pubkey: string;
    index: number;
    title: string;
    statusLabel: string;
    statusTone: StatusTone;
    statusValue: MilestoneStatus;
    evidenceUri: string;
    evidenceHashHex: string;
    evidenceSummary: string;
    attachmentCount: number;
    submittedAtLabel: string;
  };
}

interface EvidenceValidationState {
  evidenceUri?: string;
  evidenceSummary?: string;
  attachmentCount?: string;
  hashHex?: string;
}

export function EvidenceSubmitCard({
  dealPubkey,
  dealStatusValue,
  freelancerPubkey,
  milestone,
}: Readonly<EvidenceSubmissionCardProps>) {
  const router = useRouter();
  const wallet = useWallet();
  const { connection, program } = useMilestoneMindBrowserClient();
  const [evidenceUri, setEvidenceUri] = useState(milestone.evidenceUri);
  const [evidenceSummary, setEvidenceSummary] = useState(milestone.evidenceSummary);
  const [attachmentCountInput, setAttachmentCountInput] = useState(
    milestone.attachmentCount > 0 ? String(milestone.attachmentCount) : "1",
  );
  const [hashInput, setHashInput] = useState(
    isZeroEvidenceHash(milestone.evidenceHashHex) ? "" : milestone.evidenceHashHex,
  );
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const validation = useMemo(
    () =>
      validateEvidenceForm({
        evidenceUri,
        evidenceSummary,
        attachmentCountInput,
        hashInput,
      }),
    [attachmentCountInput, evidenceSummary, evidenceUri, hashInput],
  );
  const canSubmitByStatus =
    canSubmitForDealStatus(dealStatusValue)
    && canSubmitForMilestoneStatus(milestone.statusValue);
  const connectedWalletMatches =
    wallet.publicKey?.toBase58() === freelancerPubkey;
  const accessMessage = useMemo(() => {
    if (!wallet.connected || !wallet.publicKey) {
      return "Connect the freelancer wallet to submit or resubmit evidence.";
    }

    if (!connectedWalletMatches) {
      return "Connected wallet does not match the deal freelancer.";
    }

    if (!canSubmitForDealStatus(dealStatusValue)) {
      return "Evidence submit is only available while the deal is Funded or In Progress.";
    }

    if (!canSubmitForMilestoneStatus(milestone.statusValue)) {
      return "Evidence submit is only available for Pending Evidence or On Hold milestones.";
    }

    return null;
  }, [
    connectedWalletMatches,
    dealStatusValue,
    milestone.statusValue,
    wallet.connected,
    wallet.publicKey,
  ]);

  useEffect(() => {
    setEvidenceUri(milestone.evidenceUri);
    setEvidenceSummary(milestone.evidenceSummary);
    setAttachmentCountInput(milestone.attachmentCount > 0 ? String(milestone.attachmentCount) : "1");
    setHashInput(isZeroEvidenceHash(milestone.evidenceHashHex) ? "" : milestone.evidenceHashHex);
    setSelectedFileName(null);
  }, [
    milestone.attachmentCount,
    milestone.evidenceHashHex,
    milestone.evidenceSummary,
    milestone.evidenceUri,
  ]);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFileName(file?.name ?? null);

    if (!file) {
      return;
    }

    setIsHashing(true);
    setSubmitError(null);

    try {
      const hashHex = await computeSha256Hex(file);
      setHashInput(hashHex);
    } catch (error) {
      setSubmitError(toErrorMessage(error, "Unable to compute the SHA-256 hash for the selected file."));
    } finally {
      setIsHashing(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!wallet.publicKey) {
      setSubmitError("Connect the freelancer wallet to submit evidence.");
      return;
    }

    if (!connectedWalletMatches) {
      setSubmitError("Connected wallet does not match the deal freelancer.");
      return;
    }

    if (!canSubmitByStatus) {
      setSubmitError("This milestone is not in a status that allows evidence submission.");
      return;
    }

    if (!program) {
      setSubmitError("Anchor program client is not ready yet.");
      return;
    }

    if (hasValidationErrors(validation)) {
      setSubmitError("Fix the evidence form errors before submitting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = serializeEvidenceSubmissionPayload({
        evidenceUri,
        evidenceSummary,
        attachmentCountInput,
        hashHex: hashInput,
      });
      const transaction = await buildSubmitEvidenceTransaction({
        program,
        freelancer: wallet.publicKey,
        deal: new PublicKey(dealPubkey),
        milestone: new PublicKey(milestone.pubkey),
        milestoneIndex: milestone.index,
        payload,
      });
      const signature = await sendAndConfirmWalletTransaction({
        connection,
        wallet,
        transaction,
        feePayer: wallet.publicKey,
      });

      setTxSignature(signature);
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSubmitError(toErrorMessage(error, "Evidence transaction failed."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="evidence-submit-card">
      <div className="progress-title-row">
        <div>
          <p className="section-eyebrow">Evidence Submit</p>
          <h4>Freelancer write flow</h4>
        </div>
        <span className="wallet-pill">
          {canSubmitByStatus ? "Submit enabled" : "Submit locked"}
        </span>
      </div>

      <p className="muted-copy">
        Optional local file hashing never uploads the file. The SHA-256 digest is computed in the
        browser and only the URI, hash, summary, and attachment count are written on-chain.
      </p>

      {accessMessage ? <p className="field-error">{accessMessage}</p> : null}

      {txSignature ? (
        <div className="submit-success">
          <strong>Evidence transaction confirmed.</strong>
          <a href={buildExplorerTransactionUrl(txSignature)} rel="noreferrer" target="_blank">
            {formatPubkey(txSignature, 10)}
          </a>
        </div>
      ) : null}

      {accessMessage === null ? (
        <form className="evidence-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-group">
              <span>Evidence URI</span>
              <input
                maxLength={MILESTONE_MIND_MAX_LENGTHS.evidenceUri}
                onChange={(event) => setEvidenceUri(event.target.value)}
                placeholder="ipfs://... or https://..."
                type="text"
                value={evidenceUri}
              />
              {validation.evidenceUri ? <em className="field-error">{validation.evidenceUri}</em> : null}
            </label>

            <label className="field-group">
              <span>Attachment count</span>
              <input
                inputMode="numeric"
                min={1}
                onChange={(event) => setAttachmentCountInput(event.target.value)}
                placeholder="1"
                type="number"
                value={attachmentCountInput}
              />
              {validation.attachmentCount ? (
                <em className="field-error">{validation.attachmentCount}</em>
              ) : null}
            </label>
          </div>

          <label className="field-group">
            <span>Evidence summary</span>
            <textarea
              maxLength={MILESTONE_MIND_MAX_LENGTHS.evidenceSummary}
              onChange={(event) => setEvidenceSummary(event.target.value)}
              placeholder="Summarize what was delivered and how the URI proves it."
              rows={4}
              value={evidenceSummary}
            />
            {validation.evidenceSummary ? (
              <em className="field-error">{validation.evidenceSummary}</em>
            ) : null}
          </label>

          <div className="form-grid">
            <label className="field-group">
              <span>Local file for SHA-256</span>
              <input accept="*/*" onChange={handleFileChange} type="file" />
              <em className="muted-copy">
                {selectedFileName
                  ? `${selectedFileName}${isHashing ? " hashing..." : " hashed locally."}`
                  : "Optional: choose a local file to compute the hash in-browser."}
              </em>
            </label>

            <label className="field-group">
              <span>Evidence hash (hex)</span>
              <input
                onChange={(event) => setHashInput(event.target.value)}
                placeholder="64-character SHA-256 hex digest"
                type="text"
                value={hashInput}
              />
              {validation.hashHex ? <em className="field-error">{validation.hashHex}</em> : null}
            </label>
          </div>

          <div className="submit-bar">
            <div className="submit-copy">
              <strong>Milestone #{milestone.index + 1}: {milestone.title}</strong>
              <p className="muted-copy">
                Final hash: {hashInput ? formatEvidenceHashPreview(hashInput) : "not set yet"}
              </p>
            </div>
            <button
              className="primary-button"
              disabled={isSubmitting || isHashing || program === null}
              type="submit"
            >
              {isSubmitting ? "Submitting..." : milestone.statusValue === MilestoneStatus.OnHold ? "Resubmit Evidence" : "Submit Evidence"}
            </button>
          </div>

          {submitError ? <p className="field-error submit-error">{submitError}</p> : null}
        </form>
      ) : null}
    </section>
  );
}

function validateEvidenceForm(input: {
  evidenceUri: string;
  evidenceSummary: string;
  attachmentCountInput: string;
  hashInput: string;
}): EvidenceValidationState {
  const state: EvidenceValidationState = {};

  if (!input.evidenceUri.trim()) {
    state.evidenceUri = "Evidence URI is required.";
  } else if (input.evidenceUri.trim().length > MILESTONE_MIND_MAX_LENGTHS.evidenceUri) {
    state.evidenceUri =
      `Evidence URI must be ${MILESTONE_MIND_MAX_LENGTHS.evidenceUri} characters or fewer.`;
  }

  if (!input.evidenceSummary.trim()) {
    state.evidenceSummary = "Evidence summary is required.";
  } else if (input.evidenceSummary.trim().length > MILESTONE_MIND_MAX_LENGTHS.evidenceSummary) {
    state.evidenceSummary =
      `Evidence summary must be ${MILESTONE_MIND_MAX_LENGTHS.evidenceSummary} characters or fewer.`;
  }

  const attachmentCount = parseAttachmentCountInput(input.attachmentCountInput);
  if (attachmentCount === null || attachmentCount <= 0) {
    state.attachmentCount = "Attachment count must be a whole number greater than zero.";
  }

  if (!input.hashInput.trim()) {
    state.hashHex = "Evidence hash is required.";
  } else {
    try {
      normalizeEvidenceHashHex(input.hashInput);
    } catch {
      state.hashHex = "Evidence hash must be a valid 64-character SHA-256 hex string.";
    }
  }

  return state;
}

function hasValidationErrors(state: EvidenceValidationState): boolean {
  return Boolean(
    state.evidenceUri || state.evidenceSummary || state.attachmentCount || state.hashHex,
  );
}

function canSubmitForDealStatus(status: DealStatus): boolean {
  return status === DealStatus.Funded || status === DealStatus.InProgress;
}

function canSubmitForMilestoneStatus(status: MilestoneStatus): boolean {
  return status === MilestoneStatus.PendingEvidence || status === MilestoneStatus.OnHold;
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
