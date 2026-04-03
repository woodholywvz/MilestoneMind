import type { StatusTone } from "../lib/formatters";

export function StatusBadge({
  label,
  tone,
}: Readonly<{
  label: string;
  tone: StatusTone;
}>) {
  return <span className={`status-badge status-${tone}`}>{label}</span>;
}
