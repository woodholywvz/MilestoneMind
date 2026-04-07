"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { MILESTONE_MIND_MAX_LENGTHS } from "@milestone-mind/shared";
import type { PlatformConfigAccount } from "@milestone-mind/shared/onchain";
import { useMilestoneMindBrowserClient } from "../lib/anchor/browser";
import {
  fetchPlatformConfigAccount,
  fetchWalletTokenBalance,
} from "../lib/anchor/browser-queries";
import { buildExplorerTransactionUrl } from "../lib/explorer";
import {
  formatPubkey,
  formatTokenAmount,
  isPositiveTokenAmount,
  parseTokenAmountInput,
} from "../lib/formatters";
import {
  buildCreateDealTransaction,
  buildCreateMilestoneTransaction,
  buildFundDealTransaction,
  prepareCreateDealFlow,
  sendAndConfirmWalletTransaction,
  type CreateMilestoneDraft,
} from "../lib/transactions/create-deal";
import { AmountPreview } from "./AmountPreview";
import {
  MilestoneRowEditor,
  type MilestoneFormRow,
} from "./MilestoneRowEditor";
import {
  TransactionProgressPanel,
  type TransactionProgressItem,
} from "./TransactionProgressPanel";

interface ValidationState {
  freelancer?: string;
  dealTitle?: string;
  milestones?: string;
  rows: Array<{
    title?: string;
    amount?: string;
  }>;
}

export function CreateDealForm() {
  const router = useRouter();
  const wallet = useWallet();
  const { connection, program, programId } = useMilestoneMindBrowserClient();
  const [freelancerInput, setFreelancerInput] = useState("");
  const [dealTitle, setDealTitle] = useState("");
  const [rows, setRows] = useState<MilestoneFormRow[]>([
    createEmptyMilestoneRow(),
    createEmptyMilestoneRow(),
  ]);
  const [platformState, setPlatformState] = useState<{
    loading: boolean;
    platform: PlatformConfigAccount | null;
    platformPubkey: string | null;
    error: string | null;
  }>({
    loading: true,
    platform: null,
    platformPubkey: null,
    error: null,
  });
  const [balanceState, setBalanceState] = useState<{
    loading: boolean;
    amount: bigint;
    tokenAccount: string | null;
    error: string | null;
  }>({
    loading: false,
    amount: 0n,
    tokenAccount: null,
    error: null,
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<TransactionProgressItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parsedAmounts = useMemo(
    () => rows.map((row) => parseTokenAmountInput(row.amountInput) ?? 0n),
    [rows],
  );
  const totalAmount = useMemo(
    () => parsedAmounts.reduce((sum, amount) => sum + amount, 0n),
    [parsedAmounts],
  );
  const validation = useMemo(
    () => validateForm(freelancerInput, dealTitle, rows),
    [dealTitle, freelancerInput, rows],
  );

  useEffect(() => {
    let cancelled = false;

    if (!program) {
      setPlatformState({
        loading: false,
        platform: null,
        platformPubkey: null,
        error: "Connect a wallet to load platform configuration.",
      });
      return () => {
        cancelled = true;
      };
    }

    setPlatformState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void fetchPlatformConfigAccount(program)
      .then(({ publicKey, account }) => {
        if (cancelled) {
          return;
        }

        setPlatformState({
          loading: false,
          platform: account,
          platformPubkey: publicKey.toBase58(),
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPlatformState({
          loading: false,
          platform: null,
          platformPubkey: null,
          error: toErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [program]);

  useEffect(() => {
    let cancelled = false;

    if (!wallet.publicKey || !platformState.platform) {
      setBalanceState({
        loading: false,
        amount: 0n,
        tokenAccount: null,
        error: null,
      });
      return () => {
        cancelled = true;
      };
    }

    setBalanceState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    void fetchWalletTokenBalance({
      connection,
      mint: platformState.platform.usdcMint,
      owner: wallet.publicKey,
    })
      .then(({ amount, tokenAccount }) => {
        if (cancelled) {
          return;
        }

        setBalanceState({
          loading: false,
          amount,
          tokenAccount: tokenAccount?.toBase58() ?? null,
          error: null,
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setBalanceState({
          loading: false,
          amount: 0n,
          tokenAccount: null,
          error: toErrorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [connection, platformState.platform, wallet.publicKey]);

  const canSubmit =
    wallet.connected &&
    wallet.publicKey !== null &&
    program !== null &&
    platformState.platform !== null &&
    !platformState.loading &&
    !isSubmitting;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);
    setProgressSteps([]);

    if (!canSubmit || !wallet.publicKey || !program || !platformState.platform) {
      setSubmitError("Connect a wallet and wait for platform state before submitting.");
      return;
    }

    if (hasValidationErrors(validation)) {
      setSubmitError("Fix the highlighted form errors before creating the deal.");
      return;
    }

    let freelancer: PublicKey;

    try {
      freelancer = new PublicKey(freelancerInput.trim());
    } catch {
      setSubmitError("Freelancer pubkey is invalid.");
      return;
    }

    const milestones: CreateMilestoneDraft[] = rows.map((row) => ({
      title: row.title.trim(),
      amount: parseTokenAmountInput(row.amountInput) ?? 0n,
    }));
    const prepared = prepareCreateDealFlow({
      programId,
      platform: platformState.platform,
      client: wallet.publicKey,
      milestones,
    });

    if (balanceState.amount < prepared.totalAmount) {
      setSubmitError(
        `Insufficient mock USDC balance. Need ${formatTokenAmount(prepared.totalAmount)}, available ${formatTokenAmount(balanceState.amount)}.`,
      );
      return;
    }

    const initialSteps = createProgressSteps(prepared);
    setProgressSteps(initialSteps);
    setIsSubmitting(true);

    try {
      await runCreateAndFundFlow({
        wallet,
        connection,
        program,
        clientPublicKey: wallet.publicKey,
        freelancer,
        dealTitle: dealTitle.trim(),
        prepared,
        onStepPending: (stepId, detail) => updateStep(stepId, { status: "pending", detail }),
        onStepSuccess: (stepId, signature) =>
          updateStep(stepId, {
            status: "success",
            signature,
            explorerHref: buildExplorerTransactionUrl(signature),
            detail: "Confirmed on-chain.",
          }),
        onStepError: (stepId, detail) => updateStep(stepId, { status: "error", detail }),
      });

      startTransition(() => {
        router.push(`/deals/${prepared.dealPublicKey.toBase58()}`);
        router.refresh();
      });
    } catch (error) {
      setSubmitError(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  function updateRow(rowId: string, patch: Partial<MilestoneFormRow>) {
    setRows((current) =>
      current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    );
  }

  function removeRow(rowId: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== rowId) : current));
  }

  function addRow() {
    setRows((current) => [...current, createEmptyMilestoneRow()]);
  }

  function updateStep(
    stepId: string,
    patch: Partial<TransactionProgressItem>,
  ) {
    setProgressSteps((current) =>
      current.map((step) => (step.id === stepId ? { ...step, ...patch } : step)),
    );
  }

  return (
    <section className="page-content create-page">
      <section className="hero-card">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Create Deal</p>
            <h1>Draft milestones, then fund escrow immediately.</h1>
          </div>
          {platformState.platform ? (
            <div className="hero-pills">
              <span className="wallet-pill">
                Mint {formatPubkey(platformState.platform.usdcMint.toBase58(), 6)}
              </span>
              {platformState.platformPubkey ? (
                <span className="wallet-pill">
                  Platform {formatPubkey(platformState.platformPubkey, 6)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="hero-copy">
          The web client creates the deal account, writes each milestone, then funds the deal vault
          with one final escrow transfer from the connected client wallet.
        </p>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Funding Readiness</p>
            <h2>Connected client balance</h2>
          </div>
          {wallet.publicKey ? (
            <span className="wallet-pill">{formatPubkey(wallet.publicKey.toBase58(), 6)}</span>
          ) : null}
        </div>
        {platformState.error ? <p className="field-error">{platformState.error}</p> : null}
        <div className="balance-grid">
          <AmountPreview
            amount={balanceState.amount}
            detail={
              balanceState.loading
                ? "Refreshing the wallet ATA balance."
                : balanceState.tokenAccount
                  ? `ATA ${formatPubkey(balanceState.tokenAccount, 6)}`
                  : "No ATA found for the connected wallet yet."
            }
            label="Client mock USDC"
          />
          <AmountPreview
            amount={totalAmount}
            detail="This total is derived from the current milestone array."
            label="Funding required"
          />
        </div>
        {balanceState.error ? <p className="field-error">{balanceState.error}</p> : null}
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <p className="section-eyebrow">Deal Builder</p>
            <h2>Counterparty and milestone scope</h2>
          </div>
          <button className="secondary-button" onClick={addRow} type="button">
            Add milestone
          </button>
        </div>

        <form className="create-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="field-group">
              <span>Freelancer pubkey</span>
              <input
                onChange={(event) => setFreelancerInput(event.target.value)}
                placeholder="Freelancer wallet address"
                type="text"
                value={freelancerInput}
              />
              {validation.freelancer ? <em className="field-error">{validation.freelancer}</em> : null}
            </label>
            <label className="field-group">
              <span>Deal title</span>
              <input
                maxLength={MILESTONE_MIND_MAX_LENGTHS.title}
                onChange={(event) => setDealTitle(event.target.value)}
                placeholder="Website rollout with staged payouts"
                type="text"
                value={dealTitle}
              />
              {validation.dealTitle ? <em className="field-error">{validation.dealTitle}</em> : null}
            </label>
          </div>

          <div className="milestone-editor-list">
            {rows.map((row, index) => (
              <MilestoneRowEditor
                amountError={validation.rows[index]?.amount}
                canRemove={rows.length > 1}
                index={index}
                key={row.id}
                onChangeAmount={(value) => updateRow(row.id, { amountInput: value })}
                onChangeTitle={(value) => updateRow(row.id, { title: value })}
                onRemove={() => removeRow(row.id)}
                parsedAmount={parsedAmounts[index] ?? 0n}
                row={row}
                titleError={validation.rows[index]?.title}
              />
            ))}
          </div>

          {validation.milestones ? <p className="field-error">{validation.milestones}</p> : null}
          {submitError ? <p className="field-error submit-error">{submitError}</p> : null}

          <div className="submit-bar">
            <div className="submit-copy">
              <strong>Total funding target: {formatTokenAmount(totalAmount)}</strong>
              <p className="muted-copy">
                Submission order: create deal, write each milestone, then transfer the full escrow
                amount into the vault.
              </p>
            </div>
            <button className="primary-button" disabled={!canSubmit} type="submit">
              {isSubmitting ? "Submitting..." : "Create and Fund Deal"}
            </button>
          </div>
        </form>
      </section>

      <TransactionProgressPanel steps={progressSteps} />
    </section>
  );
}

function createEmptyMilestoneRow(): MilestoneFormRow {
  return {
    id: crypto.randomUUID(),
    title: "",
    amountInput: "",
  };
}

function validateForm(
  freelancerInput: string,
  dealTitle: string,
  rows: MilestoneFormRow[],
): ValidationState {
  const state: ValidationState = {
    rows: rows.map(() => ({})),
  };

  if (!freelancerInput.trim()) {
    state.freelancer = "Freelancer pubkey is required.";
  } else {
    try {
      new PublicKey(freelancerInput.trim());
    } catch {
      state.freelancer = "Enter a valid Solana pubkey.";
    }
  }

  if (!dealTitle.trim()) {
    state.dealTitle = "Deal title is required.";
  } else if (dealTitle.trim().length > MILESTONE_MIND_MAX_LENGTHS.title) {
    state.dealTitle = `Deal title must be ${MILESTONE_MIND_MAX_LENGTHS.title} characters or fewer.`;
  }

  if (rows.length === 0) {
    state.milestones = "Add at least one milestone.";
  }

  let total = 0n;
  for (const [index, row] of rows.entries()) {
    if (!row.title.trim()) {
      state.rows[index].title = "Milestone title is required.";
    } else if (row.title.trim().length > MILESTONE_MIND_MAX_LENGTHS.title) {
      state.rows[index].title =
        `Milestone title must be ${MILESTONE_MIND_MAX_LENGTHS.title} characters or fewer.`;
    }

    if (!row.amountInput.trim()) {
      state.rows[index].amount = "Amount is required.";
      continue;
    }

    if (!isPositiveTokenAmount(row.amountInput)) {
      state.rows[index].amount = "Enter a positive USDC amount with up to 6 decimals.";
      continue;
    }

    total += parseTokenAmountInput(row.amountInput) ?? 0n;
  }

  if (total <= 0n) {
    state.milestones = "The combined milestone amount must be greater than zero.";
  }

  return state;
}

function hasValidationErrors(state: ValidationState): boolean {
  return Boolean(
    state.freelancer
      || state.dealTitle
      || state.milestones
      || state.rows.some((row) => row.title || row.amount),
  );
}

function createProgressSteps(prepared: {
  milestones: Array<{ index: number }>;
}): TransactionProgressItem[] {
  return [
    {
      id: "create-deal",
      label: "Create deal account",
      status: "upcoming",
      detail: "Reserve the deal PDA and write draft state.",
    },
    ...prepared.milestones.map((milestone) => ({
      id: `create-milestone-${milestone.index}`,
      label: `Create milestone #${milestone.index + 1}`,
      status: "upcoming" as const,
      detail: "Write the milestone PDA with title and amount.",
    })),
    {
      id: "fund-deal",
      label: "Fund escrow vault",
      status: "upcoming",
      detail: "Transfer the full deal total from the client ATA into the vault ATA.",
    },
  ];
}

async function runCreateAndFundFlow(input: {
  wallet: ReturnType<typeof useWallet>;
  connection: ReturnType<typeof useMilestoneMindBrowserClient>["connection"];
  program: NonNullable<ReturnType<typeof useMilestoneMindBrowserClient>["program"]>;
  clientPublicKey: PublicKey;
  freelancer: PublicKey;
  dealTitle: string;
  prepared: ReturnType<typeof prepareCreateDealFlow>;
  onStepPending(stepId: string, detail: string): void;
  onStepSuccess(stepId: string, signature: string): void;
  onStepError(stepId: string, detail: string): void;
}) {
  await executeStep({
    stepId: "create-deal",
    detail: "Sending create_deal transaction.",
    buildTransaction: () =>
      buildCreateDealTransaction({
        program: input.program,
        client: input.clientPublicKey,
        freelancer: input.freelancer,
        title: input.dealTitle,
        prepared: input.prepared,
      }),
    ...input,
  });

  for (const milestone of input.prepared.milestones) {
    await executeStep({
      stepId: `create-milestone-${milestone.index}`,
      detail: `Sending create_milestone for index ${milestone.index}.`,
      buildTransaction: () =>
        buildCreateMilestoneTransaction({
          program: input.program,
          client: input.clientPublicKey,
          dealPublicKey: input.prepared.dealPublicKey,
          milestone,
        }),
      ...input,
    });
  }

  await executeStep({
    stepId: "fund-deal",
    detail: "Sending fund_deal transaction.",
    buildTransaction: () =>
      buildFundDealTransaction({
        program: input.program,
        client: input.clientPublicKey,
        prepared: input.prepared,
      }),
    ...input,
  });
}

async function executeStep(input: {
  stepId: string;
  detail: string;
  wallet: ReturnType<typeof useWallet>;
  connection: ReturnType<typeof useMilestoneMindBrowserClient>["connection"];
  clientPublicKey: PublicKey;
  onStepPending(stepId: string, detail: string): void;
  onStepSuccess(stepId: string, signature: string): void;
  onStepError(stepId: string, detail: string): void;
  buildTransaction(): Promise<import("@solana/web3.js").Transaction>;
}) {
  input.onStepPending(input.stepId, input.detail);

  try {
    const transaction = await input.buildTransaction();
    const signature = await sendAndConfirmWalletTransaction({
      connection: input.connection,
      wallet: input.wallet,
      transaction,
      feePayer: input.clientPublicKey,
    });

    input.onStepSuccess(input.stepId, signature);
  } catch (error) {
    const message = toErrorMessage(error);
    input.onStepError(input.stepId, message);
    throw new Error(message);
  }
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected wallet or RPC error.";
}
