"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { DealStatus, MILESTONE_MIND_MAX_LENGTHS, MilestoneStatus } from "@milestone-mind/shared";
import { PublicKey } from "@solana/web3.js";
import { useMilestoneMindBrowserClient } from "../lib/anchor/browser";
import { buildExplorerTransactionUrl } from "../lib/explorer";
import {
  computeBpsAmount,
  formatPubkey,
  formatTokenAmount,
  parseBpsInput,
} from "../lib/formatters";
import {
  buildOpenDisputeTransaction,
  buildReleaseApprovedFundsTransaction,
  buildResolveDisputeTransaction,
} from "../lib/transactions/deal-actions";
import { sendAndConfirmWalletTransaction } from "../lib/transactions/create-deal";

interface MilestoneSettlementPanelProps {
  dealPubkey: string;
  dealStatusValue: DealStatus;
  mintPubkey: string;
  clientPubkey: string;
  freelancerPubkey: string;
  platformAdminPubkey: string | null;
  platformAssessorPubkey: string | null;
  milestone: {
    pubkey: string;
    index: number;
    title: string;
    statusValue: MilestoneStatus;
    amountRaw: string;
    releasedAmountRaw: string;
    assessment: {
      approvedBps: number;
    } | null;
  };
}

export function MilestoneSettlementPanel({
  dealPubkey,
  dealStatusValue,
  mintPubkey,
  clientPubkey,
  freelancerPubkey,
  platformAdminPubkey,
  platformAssessorPubkey,
  milestone,
}: Readonly<MilestoneSettlementPanelProps>) {
  const router = useRouter();
  const wallet = useWallet();
  const { connection, program, programId } = useMilestoneMindBrowserClient();
  const [pendingAction, setPendingAction] = useState<"release" | "dispute" | "resolve" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [freelancerSplitBpsInput, setFreelancerSplitBpsInput] = useState("5000");
  const walletPubkey = wallet.publicKey?.toBase58() ?? null;
  const isClient = walletPubkey === clientPubkey;
  const isFreelancer = walletPubkey === freelancerPubkey;
  const isAdmin = walletPubkey === platformAdminPubkey;
  const isAssessor = walletPubkey === platformAssessorPubkey;
  const amount = BigInt(milestone.amountRaw);
  const releasedAmount = BigInt(milestone.releasedAmountRaw);
  const remainingAmount = amount > releasedAmount ? amount - releasedAmount : 0n;
  const splitBps = parseBpsInput(freelancerSplitBpsInput) ?? 0;
  const settlementFreelancerAmount = computeBpsAmount(remainingAmount, splitBps);
  const settlementClientAmount = remainingAmount - settlementFreelancerAmount;
  const canOpenDispute =
    (isClient || isFreelancer)
    && (dealStatusValue === DealStatus.InProgress || dealStatusValue === DealStatus.Disputed)
    && (
      milestone.statusValue === MilestoneStatus.Approved
      || milestone.statusValue === MilestoneStatus.OnHold
      || milestone.statusValue === MilestoneStatus.PaidPartial
    );
  const canRelease =
    (isClient || isAssessor)
    && (dealStatusValue === DealStatus.InProgress || dealStatusValue === DealStatus.Disputed)
    && milestone.statusValue === MilestoneStatus.Approved
    && (milestone.assessment?.approvedBps ?? 0) > 0;
  const canResolve =
    isAdmin
    && dealStatusValue === DealStatus.Disputed
    && milestone.statusValue === MilestoneStatus.InDispute;

  if (!isClient && !isFreelancer && !isAdmin && !isAssessor) {
    return null;
  }

  async function handleRelease() {
    if (!wallet.publicKey || !program) {
      setErrorMessage("Connect an authorized wallet before releasing approved funds.");
      return;
    }

    setPendingAction("release");
    setErrorMessage(null);

    try {
      const transaction = await buildReleaseApprovedFundsTransaction({
        program,
        authority: wallet.publicKey,
        programId,
        deal: new PublicKey(dealPubkey),
        mint: new PublicKey(mintPubkey),
        freelancer: new PublicKey(freelancerPubkey),
        milestoneIndex: milestone.index,
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
      setErrorMessage(toErrorMessage(error, "Release funds transaction failed."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleOpenDispute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!wallet.publicKey || !program) {
      setErrorMessage("Connect an authorized wallet before opening a dispute.");
      return;
    }

    if (!disputeReason.trim()) {
      setErrorMessage("Dispute reason is required.");
      return;
    }

    setPendingAction("dispute");
    setErrorMessage(null);

    try {
      const transaction = await buildOpenDisputeTransaction({
        program,
        caller: wallet.publicKey,
        programId,
        deal: new PublicKey(dealPubkey),
        milestoneIndex: milestone.index,
        reason: disputeReason.trim(),
      });
      const signature = await sendAndConfirmWalletTransaction({
        connection,
        wallet,
        transaction,
        feePayer: wallet.publicKey,
      });

      setTxSignature(signature);
      setDisputeReason("");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setErrorMessage(toErrorMessage(error, "Open dispute transaction failed."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleResolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!wallet.publicKey || !program) {
      setErrorMessage("Connect the admin wallet before resolving a dispute.");
      return;
    }

    const parsedSplit = parseBpsInput(freelancerSplitBpsInput);
    if (parsedSplit === null) {
      setErrorMessage("Freelancer split must be an integer between 0 and 10000.");
      return;
    }

    setPendingAction("resolve");
    setErrorMessage(null);

    try {
      const transaction = await buildResolveDisputeTransaction({
        program,
        admin: wallet.publicKey,
        programId,
        deal: new PublicKey(dealPubkey),
        mint: new PublicKey(mintPubkey),
        freelancer: new PublicKey(freelancerPubkey),
        client: new PublicKey(clientPubkey),
        milestoneIndex: milestone.index,
        freelancerSplitBps: parsedSplit,
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
      setErrorMessage(toErrorMessage(error, "Resolve dispute transaction failed."));
    } finally {
      setPendingAction(null);
    }
  }

  if (!canOpenDispute && !canRelease && !canResolve) {
    return null;
  }

  return (
    <section className="settlement-panel">
      <div className="progress-title-row">
        <div>
          <p className="section-eyebrow">Settlement Actions</p>
          <h4>Milestone #{milestone.index + 1}</h4>
        </div>
        <span className="wallet-pill">{resolveRoleLabel({ isClient, isFreelancer, isAdmin, isAssessor })}</span>
      </div>

      {canRelease ? (
        <div className="action-block">
          <p className="muted-copy">
            Release pays the AI-approved share from the vault to the freelancer ATA.
          </p>
          <button
            className="primary-button"
            disabled={pendingAction !== null}
            onClick={handleRelease}
            type="button"
          >
            {pendingAction === "release" ? "Releasing..." : "Release approved funds"}
          </button>
        </div>
      ) : null}

      {canOpenDispute ? (
        <form className="action-block action-form" onSubmit={handleOpenDispute}>
          <label className="field-group">
            <span>Open dispute reason</span>
            <textarea
              maxLength={MILESTONE_MIND_MAX_LENGTHS.disputeReason}
              onChange={(event) => setDisputeReason(event.target.value)}
              placeholder="Describe why this milestone should enter dispute resolution."
              rows={3}
              value={disputeReason}
            />
          </label>
          <button className="secondary-button" disabled={pendingAction !== null} type="submit">
            {pendingAction === "dispute" ? "Opening dispute..." : "Open dispute"}
          </button>
        </form>
      ) : null}

      {canResolve ? (
        <form className="action-block action-form" onSubmit={handleResolve}>
          <label className="field-group">
            <span>Freelancer split (bps)</span>
            <input
              max={10000}
              min={0}
              onChange={(event) => setFreelancerSplitBpsInput(event.target.value)}
              placeholder="5000"
              type="number"
              value={freelancerSplitBpsInput}
            />
          </label>
          <div className="settlement-preview-grid">
            <div className="amount-preview">
              <span className="sub-eyebrow">Remaining</span>
              <strong>{formatTokenAmount(remainingAmount)}</strong>
            </div>
            <div className="amount-preview">
              <span className="sub-eyebrow">To Freelancer</span>
              <strong>{formatTokenAmount(settlementFreelancerAmount)}</strong>
            </div>
            <div className="amount-preview">
              <span className="sub-eyebrow">To Client</span>
              <strong>{formatTokenAmount(settlementClientAmount)}</strong>
            </div>
          </div>
          <button className="primary-button" disabled={pendingAction !== null} type="submit">
            {pendingAction === "resolve" ? "Resolving..." : "Resolve dispute"}
          </button>
        </form>
      ) : null}

      {errorMessage ? <p className="field-error submit-error">{errorMessage}</p> : null}
      {txSignature ? (
        <div className="submit-success">
          <strong>Milestone action confirmed.</strong>
          <a href={buildExplorerTransactionUrl(txSignature)} rel="noreferrer" target="_blank">
            {formatPubkey(txSignature, 10)}
          </a>
        </div>
      ) : null}
    </section>
  );
}

function resolveRoleLabel(input: {
  isClient: boolean;
  isFreelancer: boolean;
  isAdmin: boolean;
  isAssessor: boolean;
}): string {
  if (input.isAdmin) {
    return "Admin";
  }
  if (input.isAssessor && input.isClient) {
    return "Client / Assessor";
  }
  if (input.isClient) {
    return "Client";
  }
  if (input.isAssessor) {
    return "Assessor";
  }
  if (input.isFreelancer) {
    return "Freelancer";
  }

  return "Viewer";
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
