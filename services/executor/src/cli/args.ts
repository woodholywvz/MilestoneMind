import { InvalidExecutorInputError } from "../lib/errors.js";

export function parseAssessmentCliArgs(argv: string[]) {
  const dealId = readFlag(argv, "--deal-id");
  const milestoneIndex = readFlag(argv, "--milestone-index");

  return {
    dealId: parseIntegerFlag(dealId, "--deal-id"),
    milestoneIndex: parseIntegerFlag(milestoneIndex, "--milestone-index"),
  };
}

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return argv[index + 1];
}

function parseIntegerFlag(rawValue: string | undefined, flagName: string): number {
  if (!rawValue) {
    throw new InvalidExecutorInputError(`Missing required CLI flag: ${flagName}`);
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new InvalidExecutorInputError(`Invalid integer value for ${flagName}: ${rawValue}`);
  }

  return parsed;
}
