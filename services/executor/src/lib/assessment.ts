import { randomUUID } from "node:crypto";
import type { AssessResponse } from "@milestone-mind/shared";
import { MilestoneMindAnchorClient } from "../anchor/client.js";
import {
  deriveAssessmentPda,
  deriveDealPda,
  deriveMilestonePda,
  derivePlatformPda,
  deriveVaultAuthorityPda,
} from "../anchor/pdas.js";
import type { ExecutorConfig } from "../env/config.js";
import { loadExecutorConfig } from "../env/config.js";
import { requestAiAssessment } from "./ai.js";
import { logError, logInfo } from "./logger.js";
import {
  assertMilestoneReadyForAssessment,
  buildAssessRequest,
  dryAssessOptionsSchema,
  parseDealStatus,
  type DryAssessOptions,
} from "./payload.js";

export interface DryAssessmentResult {
  requestId: string;
  dealId: number;
  milestoneIndex: number;
  dealPda: string;
  milestonePda: string;
  assessmentPda: string;
  vaultAuthorityPda: string;
  assessment: AssessResponse;
}

export interface DryAssessmentDependencies {
  config?: ExecutorConfig;
  requestId?: string;
  anchorClient?: Pick<MilestoneMindAnchorClient, "programId" | "fetchDeal" | "fetchMilestone">;
  requestAiAssessment?: typeof requestAiAssessment;
}

export async function performDryAssessment(
  rawOptions: DryAssessOptions,
  dependencies: DryAssessmentDependencies = {},
): Promise<DryAssessmentResult> {
  const options = dryAssessOptionsSchema.parse(rawOptions);
  const requestId = dependencies.requestId ?? createRequestId();
  const config = dependencies.config ?? loadExecutorConfig();
  const anchorClient = dependencies.anchorClient ?? new MilestoneMindAnchorClient(config);
  const invokeAiAssessment =
    dependencies.requestAiAssessment ??
    ((payload, invokeOptions) => requestAiAssessment(payload, invokeOptions));

  const dealPda = deriveDealPda(options.dealId, anchorClient.programId);
  const milestonePda = deriveMilestonePda(
    dealPda.publicKey,
    options.milestoneIndex,
    anchorClient.programId,
  );
  const assessmentPda = deriveAssessmentPda(milestonePda.publicKey, anchorClient.programId);
  const vaultAuthorityPda = deriveVaultAuthorityPda(dealPda.publicKey, anchorClient.programId);
  const context = {
    requestId,
    dealId: options.dealId,
    milestoneIndex: options.milestoneIndex,
  };

  logInfo(context, `loading on-chain accounts deal=${dealPda.publicKey.toBase58()} milestone=${milestonePda.publicKey.toBase58()}`);

  try {
    const [deal, milestone] = await Promise.all([
      anchorClient.fetchDeal(dealPda.publicKey),
      anchorClient.fetchMilestone(milestonePda.publicKey),
    ]);

    if (!milestone.deal.equals(dealPda.publicKey)) {
      throw new Error("Milestone account does not reference the derived deal PDA.");
    }

    parseDealStatus(deal.status);
    assertMilestoneReadyForAssessment(milestone);

    const requestPayload = buildAssessRequest({
      dealPublicKey: dealPda.publicKey,
      milestonePublicKey: milestonePda.publicKey,
      deal,
      milestone,
    });

    logInfo(context, `calling AI service at ${config.aiServiceBaseUrl}/assess`);
    const assessment = await invokeAiAssessment(requestPayload, {
      baseUrl: config.aiServiceBaseUrl,
      requestId,
    });
    logInfo(context, `dry-run completed decision=${assessment.decision} approvedBps=${assessment.approvedBps}`);

    return {
      requestId,
      dealId: options.dealId,
      milestoneIndex: options.milestoneIndex,
      dealPda: dealPda.publicKey.toBase58(),
      milestonePda: milestonePda.publicKey.toBase58(),
      assessmentPda: assessmentPda.publicKey.toBase58(),
      vaultAuthorityPda: vaultAuthorityPda.publicKey.toBase58(),
      assessment,
    };
  } catch (error) {
    logError(
      context,
      `dry-run failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

export function listDeriveHelpers(programId: string) {
  return {
    platform: derivePlatformPda,
    deal: deriveDealPda,
    milestone: deriveMilestonePda,
    assessment: deriveAssessmentPda,
    vaultAuthority: deriveVaultAuthorityPda,
    programId,
  };
}

export function createRequestId(): string {
  return randomUUID().slice(0, 8);
}

export function derivePlatformAddressForProgram(programId: MilestoneMindAnchorClient["programId"]) {
  return derivePlatformPda(programId).publicKey.toBase58();
}
