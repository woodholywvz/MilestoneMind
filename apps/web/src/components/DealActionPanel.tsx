"use client";

import { startTransition, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { DealStatus, MilestoneStatus } from "@milestone-mind/shared";
import { PublicKey } from "@solana/web3.js";
import { useMilestoneMindBrowserClient } from "../lib/anchor/browser";
import { buildExplorerTransactionUrl } from "../lib/explorer";
import { formatPubkey } from "../lib/formatters";
import {
  buildCancelDraftDealTransaction,
  buildFinalizeDealTransaction,
} from "../lib/transactions/deal-actions";
import { sendAndConfirmWalletTransaction } from "../lib/transactions/create-deal";

interface DealActionPanelProps {
  dealPubkey: string;
  dealStatusValue: DealStatus;
  mintPubkey: string;
  clientPubkey: string;
  milestones: Array<{
    pubkey: string;
    statusValue: MilestoneStatus;
  }>;
}

export function DealActionPanel({
  dealPubkey,
  dealStatusValue,
  mintPubkey,
  clientPubkey,
  milestones,
}: Readonly<DealActionPanelProps>) {
  const router = useRouter();
  const wallet = useWallet();
  const { connection, program, programId } = useMilestoneMindBrowserClient();
  const [pendingAction, setPendingAction] = useState<"cancel" | "finalize" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const isClient = wallet.publicKey?.toBase58() === clientPubkey;
  const allMilestonesTerminal = useMemo(
    () =>
      milestones.length > 0
      && milestones.every((milestone) =>
        milestone.statusValue === MilestoneStatus.PaidFull
        || milestone.statusValue === MilestoneStatus.Resolved
        || milestone.statusValue === MilestoneStatus.Refunded,
      ),
    [milestones],
  );
  const canCancel = dealStatusValue === DealStatus.Draft;
  const canFinalize =
    (dealStatusValue === DealStatus.InProgress || dealStatusValue === DealStatus.Disputed)
    && allMilestonesTerminal;

  if (!isClient) {
    return null;
  }

  async function handleCancel() {
    if (!wallet.publicKey || !program) {
      setErrorMessage("Connect the client wallet before cancelling a draft deal.");
      return;
    }

    setPendingAction("cancel");
    setErrorMessage(null);

    try {
      const transaction = await buildCancelDraftDealTransaction({
        program,
        client: wallet.publicKey,
        deal: new PublicKey(dealPubkey),
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
      setErrorMessage(toErrorMessage(error, "Cancel draft deal transaction failed."));
    } finally {
      setPendingAction(null);
    }
  }

  async function handleFinalize() {
    if (!wallet.publicKey || !program) {
      setErrorMessage("Connect the client wallet before finalizing the deal.");
      return;
    }

    if (!allMilestonesTerminal) {
      setErrorMessage("All milestones must be terminal before finalizing the deal.");
      return;
    }

    setPendingAction("finalize");
    setErrorMessage(null);

    try {
      const transaction = await buildFinalizeDealTransaction({
        program,
        client: wallet.publicKey,
        programId,
        deal: new PublicKey(dealPubkey),
        mint: new PublicKey(mintPubkey),
        milestonePubkeys: milestones.map((milestone) => milestone.pubkey),
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
      setErrorMessage(toErrorMessage(error, "Finalize deal transaction failed."));
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <p className="section-eyebrow">Client Actions</p>
          <h2>Deal lifecycle controls</h2>
        </div>
        <span className="wallet-pill">{formatPubkey(clientPubkey, 6)}</span>
      </div>

      <p className="muted-copy">
        Cancel is only available while the deal is still Draft and unfunded. Finalize is only
        available after every milestone becomes terminal.
      </p>

      <div className="deal-action-grid">
        <button
          className="secondary-button"
          disabled={!canCancel || pendingAction !== null || program === null}
          onClick={handleCancel}
          type="button"
        >
          {pendingAction === "cancel" ? "Cancelling..." : "Cancel draft deal"}
        </button>
        <button
          className="primary-button"
          disabled={!canFinalize || pendingAction !== null || program === null}
          onClick={handleFinalize}
          type="button"
        >
          {pendingAction === "finalize" ? "Finalizing..." : "Finalize deal"}
        </button>
      </div>

      {!allMilestonesTerminal && dealStatusValue !== DealStatus.Draft ? (
        <p className="muted-copy">
          Finalize stays locked until all milestones are `PaidFull`, `Resolved`, or `Refunded`.
        </p>
      ) : null}
      {errorMessage ? <p className="field-error submit-error">{errorMessage}</p> : null}
      {txSignature ? (
        <div className="submit-success">
          <strong>Deal action confirmed.</strong>
          <a href={buildExplorerTransactionUrl(txSignature)} rel="noreferrer" target="_blank">
            {formatPubkey(txSignature, 10)}
          </a>
        </div>
      ) : null}
    </section>
  );
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}
