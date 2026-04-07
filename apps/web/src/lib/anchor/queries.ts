import "server-only";

import { PublicKey, type GetProgramAccountsFilter } from "@solana/web3.js";
import type { Program } from "@coral-xyz/anchor";
import type { MilestoneMindIdl } from "@milestone-mind/shared/idl";
import type {
  AssessmentAccount,
  DealAccount,
  MilestoneAccount,
  PlatformConfigAccount,
} from "@milestone-mind/shared/onchain";
import { buildExplorerAccountUrl } from "../explorer";
import {
  formatAssessmentDecision,
  formatBps,
  formatDealStatus,
  formatMilestoneStatus,
  formatTokenAmount,
  formatTimestamp,
} from "../formatters";
import { createProgramId, createReadonlyProgram } from "./client";
import {
  deriveAssessmentPda,
  derivePlatformPda,
  deriveVaultAuthorityPda,
} from "./pdas";

const ACCOUNT_DISCRIMINATOR_SIZE = 8;

type ProgramAccountRecord<T> = {
  publicKey: PublicKey;
  account: T;
};

type AccountClient<T> = {
  all(filters?: GetProgramAccountsFilter[]): Promise<Array<ProgramAccountRecord<T>>>;
  fetch(address: PublicKey): Promise<T>;
  fetchNullable?(address: PublicKey): Promise<T | null>;
};

export interface DealListItem {
  pubkey: string;
  detailHref: string;
  explorerHref: string;
  dealId: number;
  title: string;
  statusLabel: string;
  statusTone: ReturnType<typeof formatDealStatus>["tone"];
  clientPubkey: string;
  freelancerPubkey: string;
  totalAmountLabel: string;
  fundedAmountLabel: string;
  milestoneCount: number;
  settledMilestones: number;
  createdAtLabel: string;
}

export interface AssessmentView {
  pubkey: string;
  summary: string;
  decisionLabel: string;
  decisionTone: ReturnType<typeof formatAssessmentDecision>["tone"];
  confidenceLabel: string;
  approvedLabel: string;
  rationaleHashHex: string;
  createdAtLabel: string;
}

export interface MilestoneView {
  pubkey: string;
  index: number;
  title: string;
  statusLabel: string;
  statusTone: ReturnType<typeof formatMilestoneStatus>["tone"];
  statusValue: ReturnType<typeof formatMilestoneStatus>["value"];
  amountLabel: string;
  releasedAmountLabel: string;
  evidenceUri: string;
  evidenceHashHex: string;
  evidenceSummary: string;
  attachmentCount: number;
  submittedAtLabel: string;
  assessment: AssessmentView | null;
}

export interface DealDetailView {
  pubkey: string;
  explorerHref: string;
  vaultAuthority: string;
  vaultAuthorityExplorerHref: string;
  dealId: number;
  title: string;
  statusLabel: string;
  statusTone: ReturnType<typeof formatDealStatus>["tone"];
  statusValue: ReturnType<typeof formatDealStatus>["value"];
  clientPubkey: string;
  clientExplorerHref: string;
  freelancerPubkey: string;
  freelancerExplorerHref: string;
  platformAdminPubkey: string | null;
  platformAssessorPubkey: string | null;
  mintPubkey: string;
  mintExplorerHref: string;
  totalAmountLabel: string;
  fundedAmountLabel: string;
  milestoneCount: number;
  settledMilestones: number;
  createdAtLabel: string;
  milestones: MilestoneView[];
}

export async function fetchAllDeals(): Promise<DealListItem[]> {
  const program = createReadonlyProgram();
  const dealClient = getAccountClient<DealAccount>(program, "deal");
  const records = await dealClient.all();

  return records
    .map(({ publicKey, account }) => {
      const status = formatDealStatus(account.status);

      return {
        pubkey: publicKey.toBase58(),
        detailHref: `/deals/${publicKey.toBase58()}`,
        explorerHref: buildExplorerAccountUrl(publicKey.toBase58()),
        dealId: Number.parseInt(account.dealId.toString(), 10),
        title: account.title,
        statusLabel: status.label,
        statusTone: status.tone,
        clientPubkey: account.client.toBase58(),
        freelancerPubkey: account.freelancer.toBase58(),
        totalAmountLabel: formatTokenAmount(account.totalAmount),
        fundedAmountLabel: formatTokenAmount(account.fundedAmount),
        milestoneCount: account.milestoneCount,
        settledMilestones: account.settledMilestones,
        createdAtLabel: formatTimestamp(account.createdAt),
      };
    })
    .sort((left, right) => right.dealId - left.dealId);
}

export async function fetchDealDetail(dealPubkey: string): Promise<DealDetailView | null> {
  const program = createReadonlyProgram();
  const programId = createProgramId();
  const dealClient = getAccountClient<DealAccount>(program, "deal");
  const milestoneClient = getAccountClient<MilestoneAccount>(program, "milestone");
  const assessmentClient = getAccountClient<AssessmentAccount>(program, "assessment");
  const platformClient = getAccountClient<PlatformConfigAccount>(program, "platformConfig");
  const dealPublicKey = new PublicKey(dealPubkey);

  const deal = await fetchNullable(dealClient, dealPublicKey);

  if (deal === null) {
    return null;
  }

  const platform = await fetchNullable(
    platformClient,
    derivePlatformPda(programId).publicKey,
  );

  const milestoneFilter: GetProgramAccountsFilter = {
    memcmp: {
      offset: ACCOUNT_DISCRIMINATOR_SIZE,
      bytes: dealPublicKey.toBase58(),
    },
  };
  const milestones = await milestoneClient.all([milestoneFilter]);
  const sortedMilestones = milestones.sort(
    (left, right) => left.account.index - right.account.index,
  );

  const milestoneViews = await Promise.all(
    sortedMilestones.map(async ({ publicKey, account }) => {
      const milestoneStatus = formatMilestoneStatus(account.status);
      const assessmentPda = deriveAssessmentPda(publicKey, programId);
      const assessment = await fetchNullable(assessmentClient, assessmentPda.publicKey);

      return {
        pubkey: publicKey.toBase58(),
        index: account.index,
        title: account.title,
        statusLabel: milestoneStatus.label,
        statusTone: milestoneStatus.tone,
        statusValue: milestoneStatus.value,
        amountLabel: formatTokenAmount(account.amount),
        releasedAmountLabel: formatTokenAmount(account.releasedAmount),
        evidenceUri: account.evidenceUri,
        evidenceHashHex: toHex(account.evidenceHash),
        evidenceSummary: account.evidenceSummary,
        attachmentCount: account.attachmentCount,
        submittedAtLabel: formatTimestamp(account.lastSubmittedAt),
        assessment: assessment
          ? mapAssessmentView(assessmentPda.publicKey.toBase58(), assessment)
          : null,
      };
    }),
  );

  const dealStatus = formatDealStatus(deal.status);
  const vaultAuthority = deriveVaultAuthorityPda(dealPublicKey, programId).publicKey.toBase58();

  return {
    pubkey: dealPublicKey.toBase58(),
    explorerHref: buildExplorerAccountUrl(dealPublicKey.toBase58()),
    vaultAuthority,
    vaultAuthorityExplorerHref: buildExplorerAccountUrl(vaultAuthority),
    dealId: Number.parseInt(deal.dealId.toString(), 10),
    title: deal.title,
    statusLabel: dealStatus.label,
    statusTone: dealStatus.tone,
    statusValue: dealStatus.value,
    clientPubkey: deal.client.toBase58(),
    clientExplorerHref: buildExplorerAccountUrl(deal.client.toBase58()),
    freelancerPubkey: deal.freelancer.toBase58(),
    freelancerExplorerHref: buildExplorerAccountUrl(deal.freelancer.toBase58()),
    platformAdminPubkey: platform?.admin.toBase58() ?? null,
    platformAssessorPubkey: platform?.assessor.toBase58() ?? null,
    mintPubkey: deal.mint.toBase58(),
    mintExplorerHref: buildExplorerAccountUrl(deal.mint.toBase58()),
    totalAmountLabel: formatTokenAmount(deal.totalAmount),
    fundedAmountLabel: formatTokenAmount(deal.fundedAmount),
    milestoneCount: deal.milestoneCount,
    settledMilestones: deal.settledMilestones,
    createdAtLabel: formatTimestamp(deal.createdAt),
    milestones: milestoneViews,
  };
}

function getAccountClient<T>(
  program: Program<MilestoneMindIdl>,
  name: string,
): AccountClient<T> {
  const namespace = program.account as Record<string, AccountClient<T>>;
  const client = namespace[name];

  if (!client) {
    throw new Error(`Anchor account namespace is missing ${name}.`);
  }

  return client;
}

async function fetchNullable<T>(
  client: AccountClient<T>,
  address: PublicKey,
): Promise<T | null> {
  if (typeof client.fetchNullable === "function") {
    return (await client.fetchNullable(address)) ?? null;
  }

  try {
    return await client.fetch(address);
  } catch (error) {
    if (error instanceof Error && /does not exist|no data/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}

function mapAssessmentView(pubkey: string, assessment: AssessmentAccount): AssessmentView {
  const decision = formatAssessmentDecision(assessment.decision);

  return {
    pubkey,
    summary: assessment.summary,
    decisionLabel: decision.label,
    decisionTone: decision.tone,
    confidenceLabel: formatBps(assessment.confidenceBps),
    approvedLabel: formatBps(assessment.approvedBps),
    rationaleHashHex: toHex(assessment.rationaleHash),
    createdAtLabel: formatTimestamp(assessment.createdAt),
  };
}

function toHex(value: ArrayLike<number>): string {
  return Array.from(value, (item) => item.toString(16).padStart(2, "0")).join("");
}
