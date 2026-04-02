export interface LogContext {
  requestId: string;
  dealId?: number | string;
  milestoneIndex?: number | string;
}

export function logInfo(context: LogContext, message: string): void {
  console.log(formatLogLine("info", context, message));
}

export function logError(context: LogContext, message: string): void {
  console.error(formatLogLine("error", context, message));
}

function formatLogLine(level: "info" | "error", context: LogContext, message: string): string {
  const dealId = context.dealId ?? "-";
  const milestoneIndex = context.milestoneIndex ?? "-";

  return `[executor] level=${level} req=${context.requestId} deal=${dealId} milestone=${milestoneIndex} ${message}`;
}
