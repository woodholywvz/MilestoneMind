"use client";

import { MILESTONE_MIND_MAX_LENGTHS } from "@milestone-mind/shared";
import { AmountPreview } from "./AmountPreview";

export interface MilestoneFormRow {
  id: string;
  title: string;
  amountInput: string;
}

export function MilestoneRowEditor({
  index,
  row,
  canRemove,
  titleError,
  amountError,
  parsedAmount,
  onChangeTitle,
  onChangeAmount,
  onRemove,
}: Readonly<{
  index: number;
  row: MilestoneFormRow;
  canRemove: boolean;
  titleError?: string;
  amountError?: string;
  parsedAmount: bigint;
  onChangeTitle(value: string): void;
  onChangeAmount(value: string): void;
  onRemove(): void;
}>) {
  return (
    <div className="milestone-editor">
      <div className="milestone-editor-header">
        <div>
          <p className="section-eyebrow">Milestone {index + 1}</p>
          <h3>Scope and amount</h3>
        </div>
        <button
          className="secondary-button"
          disabled={!canRemove}
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>
      <div className="form-grid">
        <label className="field-group">
          <span>Milestone title</span>
          <input
            maxLength={MILESTONE_MIND_MAX_LENGTHS.title}
            onChange={(event) => onChangeTitle(event.target.value)}
            placeholder="Production rollout checklist"
            type="text"
            value={row.title}
          />
          {titleError ? <em className="field-error">{titleError}</em> : null}
        </label>
        <label className="field-group">
          <span>Amount (USDC)</span>
          <input
            inputMode="decimal"
            onChange={(event) => onChangeAmount(event.target.value)}
            placeholder="1250.00"
            type="text"
            value={row.amountInput}
          />
          {amountError ? <em className="field-error">{amountError}</em> : null}
        </label>
      </div>
      <AmountPreview
        amount={parsedAmount}
        detail="Amounts are converted to 6-decimal mock USDC base units before submission."
        label="Milestone preview"
      />
    </div>
  );
}
