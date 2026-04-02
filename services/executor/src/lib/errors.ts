export class ExecutorError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 500,
  ) {
    super(message);
    this.name = "ExecutorError";
  }
}

export class InvalidExecutorInputError extends ExecutorError {
  constructor(message: string) {
    super(message, "INVALID_INPUT", 400);
    this.name = "InvalidExecutorInputError";
  }
}

export class MilestoneNotReadyError extends ExecutorError {
  constructor(status: string) {
    super(
      `Milestone must be in EvidenceSubmitted status before assessment dry-run. Current status: ${status}.`,
      "MILESTONE_NOT_READY",
      409,
    );
    this.name = "MilestoneNotReadyError";
  }
}

export class AiServiceError extends ExecutorError {
  constructor(message: string, statusCode = 502) {
    super(message, "AI_SERVICE_ERROR", statusCode);
    this.name = "AiServiceError";
  }
}
