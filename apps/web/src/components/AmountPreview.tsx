import { formatTokenAmount } from "../lib/formatters";

export function AmountPreview({
  label,
  amount,
  detail,
}: Readonly<{
  label: string;
  amount: bigint;
  detail?: string;
}>) {
  return (
    <div className="amount-preview">
      <p className="sub-eyebrow">{label}</p>
      <strong>{formatTokenAmount(amount)}</strong>
      {detail ? <p className="muted-copy">{detail}</p> : null}
    </div>
  );
}
