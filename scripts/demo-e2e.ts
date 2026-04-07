import { createHash } from "node:crypto";
import { AnchorProvider, BN, Program, Wallet, web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { milestoneMindIdl, type MilestoneMindIdl } from "@milestone-mind/shared/idl";
import { performCommitAssessment } from "../services/executor/src/lib/assessment.ts";
import {
  deriveAssessmentPda,
  deriveDealPda,
  deriveMilestonePda,
  derivePlatformPda,
  deriveVaultAuthorityPda,
} from "../services/executor/src/anchor/pdas.ts";
import {
  defaultDemoEnvFile,
  detectRpcUrl,
  readEnvFile,
  readKeypair,
} from "./demo-utils.mjs";

const DEFAULT_PROGRAM_ID = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x";
const AI_BASE_URL = (process.env.EXECUTOR_AI_BASE_URL ?? process.env.AI_SERVICE_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/+$/, "");

const demoEnv = readEnvFile(defaultDemoEnvFile);
const rpcUrl = detectRpcUrl(demoEnv);
const programId = new web3.PublicKey(
  process.env.MILESTONE_MIND_PROGRAM_ID ?? demoEnv.MILESTONE_MIND_PROGRAM_ID ?? DEFAULT_PROGRAM_ID,
);
const mintAddress = process.env.MOCK_USDC_MINT ?? demoEnv.MOCK_USDC_MINT;
const adminKeypairPath = process.env.DEMO_ADMIN_KEYPAIR ?? demoEnv.DEMO_ADMIN_KEYPAIR;
const clientKeypairPath = process.env.DEMO_CLIENT_KEYPAIR ?? demoEnv.DEMO_CLIENT_KEYPAIR;
const freelancerKeypairPath = process.env.DEMO_FREELANCER_KEYPAIR ?? demoEnv.DEMO_FREELANCER_KEYPAIR;
const assessorKeypairPath = process.env.DEMO_ASSESSOR_KEYPAIR ?? demoEnv.DEMO_ASSESSOR_KEYPAIR;

if (!mintAddress) {
  throw new Error("MOCK_USDC_MINT is required. `demo:bootstrap-mint` must run before `demo:e2e`.");
}
if (!adminKeypairPath || !clientKeypairPath || !freelancerKeypairPath || !assessorKeypairPath) {
  throw new Error("Demo wallets are missing. `demo:create-wallets` must run before `demo:e2e`.");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[demo:e2e] level=error ${message}`);
  process.exitCode = 1;
});

async function main(): Promise<void> {
  const connection = new web3.Connection(rpcUrl, "confirmed");
  const mint = new web3.PublicKey(mintAddress);
  const admin = readKeypair(adminKeypairPath);
  const client = readKeypair(clientKeypairPath);
  const freelancer = readKeypair(freelancerKeypairPath);
  const assessor = readKeypair(assessorKeypairPath);
  const adminProgram = createProgram(connection, admin, programId);
  const clientProgram = createProgram(connection, client, programId);
  const freelancerProgram = createProgram(connection, freelancer, programId);
  const accountNamespaces = adminProgram.account as Record<string, FetchableAccountNamespace>;
  const milestones = [
    {
      title: "Launch production homepage",
      amount: 3_500_000n,
      evidenceUri: "ipfs://milestonemind/demo/homepage-launch",
      evidenceSummary:
        "Final delivered production homepage accepted by the client. Complete invoice, rollout notes, deployment screenshots, and production verification bundle are included for the milestone review.",
      attachmentCount: 4,
    },
    {
      title: "Publish analytics and handoff package",
      amount: 2_500_000n,
      evidenceUri: "ipfs://milestonemind/demo/analytics-handoff",
      evidenceSummary:
        "Final delivered production analytics handoff accepted by the client. Complete invoice, dashboard exports, production checklist, and delivery notes are attached for assessor review.",
      attachmentCount: 4,
    },
  ] as const;

  await assertServiceHealth(`${AI_BASE_URL}/health`, "AI service");

  logSection("Environment");
  console.log(`[demo:e2e] rpc=${rpcUrl}`);
  console.log(`[demo:e2e] program=${programId.toBase58()}`);
  console.log(`[demo:e2e] mint=${mint.toBase58()}`);
  console.log(`[demo:e2e] admin=${admin.publicKey.toBase58()}`);
  console.log(`[demo:e2e] client=${client.publicKey.toBase58()}`);
  console.log(`[demo:e2e] freelancer=${freelancer.publicKey.toBase58()}`);
  console.log(`[demo:e2e] assessor=${assessor.publicKey.toBase58()}`);

  const platformPda = derivePlatformPda(programId).publicKey;
  const existingPlatform = await fetchNullable(accountNamespaces.platformConfig, platformPda);

  if (existingPlatform === null) {
    const signature = await (adminProgram.methods as any)
      .initializePlatform(admin.publicKey, assessor.publicKey, mint)
      .accounts({
        payer: admin.publicKey,
        platform: platformPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    logSignature("initialize_platform", signature);
  } else {
    if (!existingPlatform.usdcMint.equals(mint)) {
      throw new Error(
        `Platform already exists with mint ${existingPlatform.usdcMint.toBase58()}, but demo:e2e just bootstrapped ${mint.toBase58()}. Restart the validator for a clean demo.`,
      );
    }

    console.log(`[demo:e2e] step=initialize_platform status=skipped platform=${platformPda.toBase58()}`);
  }

  const platform = await accountNamespaces.platformConfig.fetch(platformPda);
  const dealId = Number.parseInt(platform.nextDealId.toString(), 10);
  const dealPda = deriveDealPda(dealId, programId).publicKey;
  const totalAmount = milestones.reduce((sum, milestone) => sum + milestone.amount, 0n);
  const vaultAuthority = deriveVaultAuthorityPda(dealPda, programId).publicKey;
  const clientTokenAccount = getAssociatedTokenAddressSync(mint, client.publicKey);
  const vaultTokenAccount = getAssociatedTokenAddressSync(mint, vaultAuthority, true);

  logSection("Create");
  const createDealSignature = await (clientProgram.methods as any)
    .createDeal(freelancer.publicKey, "MilestoneMind demo delivery", milestones.length, new BN(totalAmount.toString()))
    .accounts({
      platform: platformPda,
      client: client.publicKey,
      deal: dealPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  logSignature("create_deal", createDealSignature);

  for (const [index, milestone] of milestones.entries()) {
    const milestonePda = deriveMilestonePda(dealPda, index, programId).publicKey;
    const signature = await (clientProgram.methods as any)
      .createMilestone(index, milestone.title, new BN(milestone.amount.toString()))
      .accounts({
        client: client.publicKey,
        deal: dealPda,
        milestone: milestonePda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    logSignature(`create_milestone#${index}`, signature);
  }

  logSection("Fund");
  const fundSignature = await (clientProgram.methods as any)
    .fundDeal()
    .accounts({
      platform: platformPda,
      client: client.publicKey,
      deal: dealPda,
      mint,
      vaultAuthority,
      clientTokenAccount,
      vaultTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  logSignature("fund_deal", fundSignature);

  logSection("Evidence");
  for (const [index, milestone] of milestones.entries()) {
    const milestonePda = deriveMilestonePda(dealPda, index, programId).publicKey;
    const evidenceHash = buildEvidenceHash(milestone.evidenceUri, milestone.evidenceSummary);
    const signature = await (freelancerProgram.methods as any)
      .submitEvidence(
        index,
        milestone.evidenceUri,
        Array.from(evidenceHash),
        milestone.evidenceSummary,
        milestone.attachmentCount,
      )
      .accounts({
        freelancer: freelancer.publicKey,
        deal: dealPda,
        milestone: milestonePda,
      })
      .rpc();
    logSignature(`submit_evidence#${index}`, signature);
  }

  logSection("Assess Commit");
  for (const [index] of milestones.entries()) {
    const result = await performCommitAssessment(
      { dealId, milestoneIndex: index },
      {
        config: {
          executorHost: "127.0.0.1",
          executorPort: 8080,
          solanaRpcUrl: rpcUrl,
          executorWalletPath: assessorKeypairPath,
          aiServiceBaseUrl: AI_BASE_URL,
          programId,
        },
        requestId: `demo-${dealId}-${index}`,
      },
    );

    console.log(
      `[demo:e2e] step=assess_commit milestone=${index} signature=${result.txSignature} decision=${result.verdict.decision} approvedBps=${result.verdict.approvedBps} status=${result.milestoneStatus}`,
    );
  }

  logSection("Release");
  for (const [index] of milestones.entries()) {
    const milestonePda = deriveMilestonePda(dealPda, index, programId).publicKey;
    const assessmentPda = deriveAssessmentPda(milestonePda, programId).publicKey;
    const freelancerTokenAccount = getAssociatedTokenAddressSync(mint, freelancer.publicKey);
    const signature = await (clientProgram.methods as any)
      .releaseApprovedFunds(index)
      .accounts({
        platform: platformPda,
        deal: dealPda,
        authority: client.publicKey,
        milestone: milestonePda,
        assessment: assessmentPda,
        mint,
        vaultAuthority,
        vaultTokenAccount,
        freelancer: freelancer.publicKey,
        freelancerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
    logSignature(`release_approved_funds#${index}`, signature);
  }

  logSection("Finalize");
  const finalizeSignature = await (clientProgram.methods as any)
    .finalizeDeal()
    .accounts({
      platform: platformPda,
      client: client.publicKey,
      deal: dealPda,
      mint,
      vaultAuthority,
      vaultTokenAccount,
      clientTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
    })
    .remainingAccounts(
      milestones.map((_, index) => ({
        pubkey: deriveMilestonePda(dealPda, index, programId).publicKey,
        isWritable: false,
        isSigner: false,
      })),
    )
    .rpc();
  logSignature("finalize_deal", finalizeSignature);

  const finalizedDeal = await (clientProgram.account as Record<string, FetchableAccountNamespace>).deal.fetch(dealPda);
  const clientBalance = await connection.getTokenAccountBalance(clientTokenAccount).catch(() => null);
  const freelancerTokenAccount = getAssociatedTokenAddressSync(mint, freelancer.publicKey);
  const freelancerBalance = await connection.getTokenAccountBalance(freelancerTokenAccount).catch(() => null);

  logSection("Summary");
  console.log(`[demo:e2e] deal=${dealPda.toBase58()} status=${Object.keys(finalizedDeal.status)[0]} settled=${finalizedDeal.settledMilestones}/${finalizedDeal.milestoneCount}`);
  console.log(`[demo:e2e] client_ata=${clientTokenAccount.toBase58()} balance=${clientBalance?.value.amount ?? "0"}`);
  console.log(`[demo:e2e] freelancer_ata=${freelancerTokenAccount.toBase58()} balance=${freelancerBalance?.value.amount ?? "0"}`);
}

function createProgram(
  connection: web3.Connection,
  keypair: web3.Keypair,
  programId: web3.PublicKey,
): Program<MilestoneMindIdl> {
  const provider = new AnchorProvider(connection, new Wallet(keypair), {
    commitment: "confirmed",
  });

  return new Program(
    {
      ...milestoneMindIdl,
      address: programId.toBase58(),
    },
    provider,
  );
}

function buildEvidenceHash(uri: string, summary: string): Uint8Array {
  return createHash("sha256").update(`${uri}\n${summary}`, "utf8").digest();
}

async function assertServiceHealth(url: string, serviceName: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${serviceName} is unavailable at ${url}. Start it before running demo:e2e.`);
  }
}

function logSection(name: string): void {
  console.log(`\n[demo:e2e] === ${name} ===`);
}

function logSignature(step: string, signature: string): void {
  console.log(`[demo:e2e] step=${step} signature=${signature}`);
}

type FetchableAccountNamespace = {
  fetch(address: web3.PublicKey): Promise<any>;
  fetchNullable?(address: web3.PublicKey): Promise<any | null>;
};

async function fetchNullable(
  namespace: FetchableAccountNamespace,
  address: web3.PublicKey,
): Promise<any | null> {
  if (typeof namespace.fetchNullable === "function") {
    return (await namespace.fetchNullable(address)) ?? null;
  }

  try {
    return await namespace.fetch(address);
  } catch (error) {
    if (error instanceof Error && /does not exist|no data/i.test(error.message)) {
      return null;
    }

    throw error;
  }
}
