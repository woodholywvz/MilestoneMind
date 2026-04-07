import { randomUUID } from "node:crypto";
import type { AssessResponse, MilestoneStatus } from "@milestone-mind/shared";
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
import { AssessorWalletMismatchError } from "./errors.js";
import { logError, logInfo } from "./logger.js";
import {
  assertDealReadyForAssessmentCommit,
  assertMilestoneReadyForAssessment,
  buildAssessRequest,
  dryAssessOptionsSchema,
  mapServiceDecisionToAnchorDecision,
  parseDealStatus,
  parseMilestoneStatus,
  rationaleHashHexToBytes,
  type DryAssessOptions,
} from "./payload.js";

type ReadAssessmentAnchorClient = Pick<
  MilestoneMindAnchorClient,
  "programId" | "fetchDeal" | "fetchMilestone"
>;

type CommitAssessmentAnchorClient = ReadAssessmentAnchorClient &
  Pick<
    MilestoneMindAnchorClient,
    "walletPublicKey" | "fetchPlatformConfig" | "submitAssessment"
  >;

interface PreparedAssessmentContext {
  requestId: string;
  config: ExecutorConfig;
  options: DryAssessOptions;
  anchorClient: ReadAssessmentAnchorClient;
  dealPda: ReturnType<typeof deriveDealPda>;
  milestonePda: ReturnType<typeof deriveMilestonePda>;
  assessmentPda: ReturnType<typeof deriveAssessmentPda>;
  platformPda: ReturnType<typeof derivePlatformPda>;
  vaultAuthorityPda: ReturnType<typeof deriveVaultAuthorityPda>;
  deal: Awaited<ReturnType<ReadAssessmentAnchorClient["fetchDeal"]>>;
  milestone: Awaited<ReturnType<ReadAssessmentAnchorClient["fetchMilestone"]>>;
  requestPayload: ReturnType<typeof buildAssessRequest>;
}

export interface DryAssessmentResult {
  requestId: string;
  dealId: number;
  milestoneIndex: number;
  dealPubkey: string;
  milestonePubkey: string;
  assessmentPubkey: string;
  verdict: AssessResponse;
}

export interface CommitAssessmentResult extends DryAssessmentResult {
  txSignature: string;
  milestoneStatus: MilestoneStatus;
}

export interface DryAssessmentDependencies {
  config?: ExecutorConfig;
  requestId?: string;
  anchorClient?: ReadAssessmentAnchorClient;
  requestAiAssessment?: typeof requestAiAssessment;
}

export interface CommitAssessmentDependencies {
  config?: ExecutorConfig;
  requestId?: string;
  anchorClient?: CommitAssessmentAnchorClient;
  requestAiAssessment?: typeof requestAiAssessment;
}

export async function performDryAssessment(
  rawOptions: DryAssessOptions,
  dependencies: DryAssessmentDependencies = {},
): Promise<DryAssessmentResult> {
  const prepared = await prepareAssessmentContext(rawOptions, dependencies);
  const invokeAiAssessment =
    dependencies.requestAiAssessment ??
    ((payload, invokeOptions) => requestAiAssessment(payload, invokeOptions));

  logInfo(
    preparedContextLog(prepared),
    `calling AI service at ${prepared.config.aiServiceBaseUrl}/assess`,
  );
  const assessment = await invokeAiAssessment(prepared.requestPayload, {
    baseUrl: prepared.config.aiServiceBaseUrl,
    requestId: prepared.requestId,
  });
  logInfo(
    preparedContextLog(prepared),
    `dry-run completed decision=${assessment.decision} approvedBps=${assessment.approvedBps}`,
  );

  return {
    requestId: prepared.requestId,
    dealId: prepared.options.dealId,
    milestoneIndex: prepared.options.milestoneIndex,
    dealPubkey: prepared.dealPda.publicKey.toBase58(),
    milestonePubkey: prepared.milestonePda.publicKey.toBase58(),
    assessmentPubkey: prepared.assessmentPda.publicKey.toBase58(),
    verdict: assessment,
  };
}

export async function performCommitAssessment(
  rawOptions: DryAssessOptions,
  dependencies: CommitAssessmentDependencies = {},
): Promise<CommitAssessmentResult> {
  const prepared = await prepareAssessmentContext(rawOptions, dependencies);
  const commitAnchorClient =
    dependencies.anchorClient ?? (prepared.anchorClient as CommitAssessmentAnchorClient);
  const invokeAiAssessment =
    dependencies.requestAiAssessment ??
    ((payload, invokeOptions) => requestAiAssessment(payload, invokeOptions));

  const platform = await commitAnchorClient.fetchPlatformConfig(
    prepared.platformPda.publicKey,
  );

  if (!commitAnchorClient.walletPublicKey.equals(platform.assessor)) {
    throw new AssessorWalletMismatchError(
      platform.assessor.toBase58(),
      commitAnchorClient.walletPublicKey.toBase58(),
    );
  }

  assertDealReadyForAssessmentCommit(prepared.deal);

  logInfo(
    preparedContextLog(prepared),
    `calling AI service at ${prepared.config.aiServiceBaseUrl}/assess`,
  );
  const assessment = await invokeAiAssessment(prepared.requestPayload, {
    baseUrl: prepared.config.aiServiceBaseUrl,
    requestId: prepared.requestId,
  });

  logInfo(preparedContextLog(prepared), "submitting assessment on-chain");
  const txSignature = await commitAnchorClient.submitAssessment({
    platform: prepared.platformPda.publicKey,
    deal: prepared.dealPda.publicKey,
    milestone: prepared.milestonePda.publicKey,
    assessment: prepared.assessmentPda.publicKey,
    milestoneIndex: prepared.options.milestoneIndex,
    decision: mapServiceDecisionToAnchorDecision(assessment.decision),
    confidenceBps: assessment.confidenceBps,
    approvedBps: assessment.approvedBps,
    rationaleHash: rationaleHashHexToBytes(assessment.rationaleHashHex),
    summary: assessment.summary,
  });
  const updatedMilestone = await commitAnchorClient.fetchMilestone(
    prepared.milestonePda.publicKey,
  );
  const milestoneStatus = parseMilestoneStatus(updatedMilestone.status);

  logInfo(
    preparedContextLog(prepared),
    `commit completed signature=${txSignature} milestoneStatus=${milestoneStatus}`,
  );

  return {
    requestId: prepared.requestId,
    dealId: prepared.options.dealId,
    milestoneIndex: prepared.options.milestoneIndex,
    dealPubkey: prepared.dealPda.publicKey.toBase58(),
    milestonePubkey: prepared.milestonePda.publicKey.toBase58(),
    assessmentPubkey: prepared.assessmentPda.publicKey.toBase58(),
    txSignature,
    milestoneStatus,
    verdict: assessment,
  };
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

async function prepareAssessmentContext(
  rawOptions: DryAssessOptions,
  dependencies: DryAssessmentDependencies,
): Promise<PreparedAssessmentContext> {
  const options = dryAssessOptionsSchema.parse(rawOptions);
  const requestId = dependencies.requestId ?? createRequestId();
  const config = dependencies.config ?? loadExecutorConfig();
  const anchorClient =
    dependencies.anchorClient ?? new MilestoneMindAnchorClient(config);
  const dealPda = deriveDealPda(options.dealId, anchorClient.programId);
  const milestonePda = deriveMilestonePda(
    dealPda.publicKey,
    options.milestoneIndex,
    anchorClient.programId,
  );
  const assessmentPda = deriveAssessmentPda(milestonePda.publicKey, anchorClient.programId);
  const platformPda = derivePlatformPda(anchorClient.programId);
  const vaultAuthorityPda = deriveVaultAuthorityPda(dealPda.publicKey, anchorClient.programId);
  const context = { requestId, dealId: options.dealId, milestoneIndex: options.milestoneIndex };

  logInfo(
    context,
    `loading on-chain accounts deal=${dealPda.publicKey.toBase58()} milestone=${milestonePda.publicKey.toBase58()}`,
  );

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

    return {
      requestId,
      config,
      options,
      anchorClient,
      dealPda,
      milestonePda,
      assessmentPda,
      platformPda,
      vaultAuthorityPda,
      deal,
      milestone,
      requestPayload,
    };
  } catch (error) {
    logError(
      context,
      `assessment preparation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

function preparedContextLog(prepared: PreparedAssessmentContext) {
  return {
    requestId: prepared.requestId,
    dealId: prepared.options.dealId,
    milestoneIndex: prepared.options.milestoneIndex,
  };
}
