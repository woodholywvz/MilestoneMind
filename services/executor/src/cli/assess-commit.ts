import process from "node:process";
import { parseAssessmentCliArgs } from "./args.js";
import { performCommitAssessment } from "../lib/assessment.js";
import { renderCommitAssessmentOutput } from "../lib/format.js";

async function main(): Promise<void> {
  const { dealId, milestoneIndex } = parseAssessmentCliArgs(process.argv.slice(2));
  const result = await performCommitAssessment({ dealId, milestoneIndex });

  process.stdout.write(
    renderCommitAssessmentOutput({
      requestId: result.requestId,
      dealId: result.dealId,
      milestoneIndex: result.milestoneIndex,
      dealPda: result.dealPda,
      milestonePda: result.milestonePda,
      txSignature: result.txSignature,
      milestoneStatus: result.milestoneStatus,
      assessment: result.assessment,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[executor] level=error req=cli deal=- milestone=- ${message}`);
  process.exitCode = 1;
});
