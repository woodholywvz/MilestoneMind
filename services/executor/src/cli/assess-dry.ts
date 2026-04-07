import process from "node:process";
import { parseAssessmentCliArgs } from "./args.js";
import { performDryAssessment } from "../lib/assessment.js";
import { renderDryAssessmentOutput } from "../lib/format.js";

async function main(): Promise<void> {
  const { dealId, milestoneIndex } = parseAssessmentCliArgs(process.argv.slice(2));
  const result = await performDryAssessment({ dealId, milestoneIndex });

  process.stdout.write(
    renderDryAssessmentOutput({
      requestId: result.requestId,
      dealId: result.dealId,
      milestoneIndex: result.milestoneIndex,
      dealPubkey: result.dealPubkey,
      milestonePubkey: result.milestonePubkey,
      verdict: result.verdict,
    }),
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[executor] level=error req=cli deal=- milestone=- ${message}`);
  process.exitCode = 1;
});
