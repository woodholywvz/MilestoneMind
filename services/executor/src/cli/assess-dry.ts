import process from "node:process";
import { performDryAssessment } from "../lib/assessment.js";
import { renderDryAssessmentOutput } from "../lib/format.js";
import { InvalidExecutorInputError } from "../lib/errors.js";

async function main(): Promise<void> {
  const { dealId, milestoneIndex } = parseCliArgs(process.argv.slice(2));
  const result = await performDryAssessment({ dealId, milestoneIndex });

  process.stdout.write(
    renderDryAssessmentOutput({
      requestId: result.requestId,
      dealId: result.dealId,
      milestoneIndex: result.milestoneIndex,
      dealPda: result.dealPda,
      milestonePda: result.milestonePda,
      assessment: result.assessment,
    }),
  );
}

function parseCliArgs(argv: string[]) {
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

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[executor] level=error req=cli deal=- milestone=- ${message}`);
  process.exitCode = 1;
});
