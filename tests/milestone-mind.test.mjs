import assert from "node:assert/strict";
import test from "node:test";

import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotent,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  mintTo,
} from "@solana/spl-token";

const PLATFORM_SEED = Buffer.from("platform");
const DEAL_SEED = Buffer.from("deal");
const MILESTONE_SEED = Buffer.from("milestone");
const ASSESSMENT_SEED = Buffer.from("assessment");
const VAULT_SEED = Buffer.from("vault");
const MOCK_USDC_DECIMALS = 6;

function u64Le(value) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function u16Le(value) {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function enumKey(value) {
  return Object.keys(value)[0] ?? "";
}

function hexToEvidenceHash(hex) {
  const normalized = hex.trim().toLowerCase().replace(/^0x/, "");

  if (normalized.length !== 64) {
    throw new Error("Evidence hash must be 64 hex characters.");
  }

  return Uint8Array.from(
    normalized.match(/.{2}/g).map((pair) => Number.parseInt(pair, 16)),
  );
}

function evidenceHashToHex(hash) {
  return Array.from(hash, (value) => value.toString(16).padStart(2, "0")).join("");
}

function assessmentDecision(value) {
  return { [value]: {} };
}

async function airdropLamports(connection, recipient, lamports) {
  const signature = await connection.requestAirdrop(recipient, lamports);
  const latestBlockhash = await connection.getLatestBlockhash();

  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
}

test("milestone_mind happy path", async (t) => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MilestoneMind;
  const wallet = provider.wallet;
  const payer = wallet.payer;
  const client = wallet;
  const admin = wallet.publicKey;
  const freelancer = web3.Keypair.generate();
  const assessor = web3.Keypair.generate();
  const dealTitle = "Launch landing page";
  const milestoneTitles = [
    "Draft wireframes",
    "Ship responsive UI",
    "Polish analytics hooks",
  ];
  const milestoneAmounts = [
    new anchor.BN(2_000_000),
    new anchor.BN(3_000_000),
    new anchor.BN(5_000_000),
  ];
  const totalAmount = milestoneAmounts.reduce(
    (sum, amount) => sum.add(amount),
    new anchor.BN(0),
  );
  const clientStartingBalance = BigInt(20_000_000);
  const evidencePayloads = [
    {
      evidenceUri: "ipfs://milestonemind/mock-proof-001",
      evidenceHashHex: "ab".repeat(32),
      evidenceSummary: "Implemented the first responsive milestone deliverable.",
      attachmentCount: 2,
    },
    {
      evidenceUri: "ipfs://milestonemind/mock-proof-002",
      evidenceHashHex: "cd".repeat(32),
      evidenceSummary: "Submitted rollout package that still needs clarifying proof.",
      attachmentCount: 2,
    },
    {
      evidenceUri: "ipfs://milestonemind/mock-proof-003",
      evidenceHashHex: "ef".repeat(32),
      evidenceSummary: "Submitted evidence package that will be disputed.",
      attachmentCount: 1,
    },
  ];

  await airdropLamports(provider.connection, freelancer.publicKey, web3.LAMPORTS_PER_SOL);
  await airdropLamports(provider.connection, assessor.publicKey, web3.LAMPORTS_PER_SOL);

  const usdcMint = await createMint(
    provider.connection,
    payer,
    payer.publicKey,
    null,
    MOCK_USDC_DECIMALS,
  );
  const clientTokenAccount = await createAssociatedTokenAccountIdempotent(
    provider.connection,
    payer,
    usdcMint,
    client.publicKey,
  );

  await mintTo(
    provider.connection,
    payer,
    usdcMint,
    clientTokenAccount,
    payer,
    clientStartingBalance,
  );

  await t.test("create mint and mint test tokens to client", async () => {
    const mintAccount = await getMint(provider.connection, usdcMint);
    const clientAccount = await getAccount(provider.connection, clientTokenAccount);

    assert.equal(mintAccount.decimals, MOCK_USDC_DECIMALS);
    assert.equal(clientAccount.amount, clientStartingBalance);
  });

  const [platformPda] = web3.PublicKey.findProgramAddressSync(
    [PLATFORM_SEED],
    program.programId,
  );

  await program.methods
    .initializePlatform(admin, assessor.publicKey, usdcMint)
    .accounts({
      payer: client.publicKey,
      platform: platformPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  await t.test("initialize platform works", async () => {
    const platform = await program.account.platformConfig.fetch(platformPda);

    assert.equal(platform.admin.toBase58(), admin.toBase58());
    assert.equal(platform.assessor.toBase58(), assessor.publicKey.toBase58());
    assert.equal(platform.usdcMint.toBase58(), usdcMint.toBase58());
    assert.equal(platform.nextDealId.toNumber(), 0);
    assert.equal(typeof platform.bump, "number");
  });

  const [dealPda] = web3.PublicKey.findProgramAddressSync(
    [DEAL_SEED, u64Le(0)],
    program.programId,
  );

  await program.methods
    .createDeal(freelancer.publicKey, dealTitle, milestoneTitles.length, totalAmount)
    .accounts({
      platform: platformPda,
      client: client.publicKey,
      deal: dealPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  await t.test("create deal works and increments id", async () => {
    const platform = await program.account.platformConfig.fetch(platformPda);
    const deal = await program.account.deal.fetch(dealPda);

    assert.equal(platform.nextDealId.toNumber(), 1);
    assert.equal(deal.dealId.toNumber(), 0);
    assert.equal(deal.client.toBase58(), client.publicKey.toBase58());
    assert.equal(deal.freelancer.toBase58(), freelancer.publicKey.toBase58());
    assert.equal(deal.mint.toBase58(), usdcMint.toBase58());
    assert.equal(deal.totalAmount.toString(), totalAmount.toString());
    assert.equal(deal.fundedAmount.toNumber(), 0);
    assert.equal(deal.milestoneCount, milestoneTitles.length);
    assert.equal(deal.settledMilestones, 0);
    assert.equal(enumKey(deal.status), "draft");
    assert.equal(deal.title, dealTitle);
    assert.ok(deal.createdAt.gt(new anchor.BN(0)));
    assert.equal(typeof deal.bump, "number");
  });

  const milestonePdas = milestoneTitles.map((_, index) =>
    web3.PublicKey.findProgramAddressSync(
      [MILESTONE_SEED, dealPda.toBuffer(), u16Le(index)],
      program.programId,
    )[0],
  );
  const assessmentPdas = milestonePdas.map((milestonePda) =>
    web3.PublicKey.findProgramAddressSync(
      [ASSESSMENT_SEED, milestonePda.toBuffer()],
      program.programId,
    )[0],
  );
  const [vaultAuthorityPda] = web3.PublicKey.findProgramAddressSync(
    [VAULT_SEED, dealPda.toBuffer()],
    program.programId,
  );
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    usdcMint,
    vaultAuthorityPda,
    true,
  );
  const freelancerTokenAccount = getAssociatedTokenAddressSync(
    usdcMint,
    freelancer.publicKey,
  );

  async function submitEvidenceForMilestone(index) {
    const payload = evidencePayloads[index];

    await program.methods
      .submitEvidence(
        index,
        payload.evidenceUri,
        Array.from(hexToEvidenceHash(payload.evidenceHashHex)),
        payload.evidenceSummary,
        payload.attachmentCount,
      )
      .accounts({
        freelancer: freelancer.publicKey,
        deal: dealPda,
        milestone: milestonePdas[index],
      })
      .signers([freelancer])
      .rpc();
  }

  async function submitAssessmentForMilestone(
    index,
    decision,
    confidenceBps,
    approvedBps,
    rationaleHashHex,
    summary,
    signer = assessor,
  ) {
    await program.methods
      .submitAssessment(
        index,
        assessmentDecision(decision),
        confidenceBps,
        approvedBps,
        Array.from(hexToEvidenceHash(rationaleHashHex)),
        summary,
      )
      .accounts({
        platform: platformPda,
        assessor: signer.publicKey,
        deal: dealPda,
        milestone: milestonePdas[index],
        assessment: assessmentPdas[index],
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([signer])
      .rpc();
  }

  async function releaseApprovedFundsForMilestone(
    index,
    authority = client.publicKey,
    signers = [],
    deal = dealPda,
    milestone = milestonePdas[index],
    assessment = assessmentPdas[index],
    vaultAuthority = vaultAuthorityPda,
    vaultToken = vaultTokenAccount,
  ) {
    await program.methods
      .releaseApprovedFunds(index)
      .accounts({
        platform: platformPda,
        authority,
        deal,
        milestone,
        assessment,
        mint: usdcMint,
        vaultAuthority,
        vaultTokenAccount: vaultToken,
        freelancer: freelancer.publicKey,
        freelancerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers(signers)
      .rpc();
  }

  async function openDisputeForMilestone(
    index,
    reason,
    caller = client.publicKey,
    signers = [],
    deal = dealPda,
    milestone = milestonePdas[index],
  ) {
    await program.methods
      .openDispute(index, reason)
      .accounts({
        caller,
        deal,
        milestone,
      })
      .signers(signers)
      .rpc();
  }

  async function resolveDisputeForMilestone(
    index,
    freelancerSplitBps,
    adminSigner = client.publicKey,
    signers = [],
    deal = dealPda,
    milestone = milestonePdas[index],
    vaultAuthority = vaultAuthorityPda,
    vaultToken = vaultTokenAccount,
  ) {
    await program.methods
      .resolveDispute(index, freelancerSplitBps)
      .accounts({
        platform: platformPda,
        deal,
        admin: adminSigner,
        milestone,
        mint: usdcMint,
        vaultAuthority,
        vaultTokenAccount: vaultToken,
        freelancer: freelancer.publicKey,
        freelancerTokenAccount,
        client: client.publicKey,
        clientTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers(signers)
      .rpc();
  }

  async function cancelDraftDealFor(deal, caller = client.publicKey, signers = []) {
    await program.methods
      .cancelDraftDeal()
      .accounts({
        client: caller,
        deal,
      })
      .signers(signers)
      .rpc();
  }

  async function finalizeDealFor({
    deal,
    milestoneAccounts,
    vaultAuthority,
    vaultTokenAccount: vaultToken,
    clientSigner = client.publicKey,
    clientToken = clientTokenAccount,
    signers = [],
  }) {
    await program.methods
      .finalizeDeal()
      .accounts({
        platform: platformPda,
        client: clientSigner,
        deal,
        mint: usdcMint,
        vaultAuthority,
        vaultTokenAccount: vaultToken,
        clientTokenAccount: clientToken,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .remainingAccounts(
        milestoneAccounts.map((pubkey) => ({
          pubkey,
          isSigner: false,
          isWritable: false,
        })),
      )
      .signers(signers)
      .rpc();
  }

  for (const [index, milestoneTitle] of milestoneTitles.entries()) {
    await program.methods
      .createMilestone(index, milestoneTitle, milestoneAmounts[index])
      .accounts({
        client: client.publicKey,
        deal: dealPda,
        milestone: milestonePdas[index],
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();
  }

  await t.test("create 2-3 milestones works", async () => {
    let summedAmount = new anchor.BN(0);

    for (const [index, milestonePda] of milestonePdas.entries()) {
      const milestone = await program.account.milestone.fetch(milestonePda);

      assert.equal(milestone.index, index);
      assert.equal(milestone.title, milestoneTitles[index]);
      assert.equal(milestone.amount.toString(), milestoneAmounts[index].toString());
      summedAmount = summedAmount.add(milestone.amount);
    }

    assert.equal(summedAmount.toString(), totalAmount.toString());
  });

  await t.test("deal/milestone PDA derivation is consistent", async () => {
    const deal = await program.account.deal.fetch(dealPda);
    const [derivedDealPda] = web3.PublicKey.findProgramAddressSync(
      [DEAL_SEED, u64Le(deal.dealId.toNumber())],
      program.programId,
    );

    assert.equal(derivedDealPda.toBase58(), dealPda.toBase58());
    assert.equal(deal.dealId.toNumber(), 0);

    for (const [index, milestonePda] of milestonePdas.entries()) {
      const milestone = await program.account.milestone.fetch(milestonePda);

      const [derivedMilestonePda] = web3.PublicKey.findProgramAddressSync(
        [MILESTONE_SEED, dealPda.toBuffer(), u16Le(index)],
        program.programId,
      );

      assert.equal(derivedMilestonePda.toBase58(), milestonePda.toBase58());
      assert.equal(milestone.deal.toBase58(), dealPda.toBase58());
    }
  });

  await t.test("milestone default fields are correct", async () => {
    const milestone = await program.account.milestone.fetch(milestonePdas[0]);

    assert.equal(milestone.releasedAmount.toNumber(), 0);
    assert.equal(enumKey(milestone.status), "pendingEvidence");
    assert.equal(milestone.evidenceUri, "");
    assert.deepEqual(Array.from(milestone.evidenceHash), new Array(32).fill(0));
    assert.equal(milestone.evidenceSummary, "");
    assert.equal(milestone.attachmentCount, 0);
    assert.ok(milestone.lastSubmittedAt.eqn(0));
    assert.equal(typeof milestone.bump, "number");
  });

  await t.test("fund_deal moves client funds into the vault escrow", async () => {
    const vaultBeforeFunding = await provider.connection.getAccountInfo(vaultTokenAccount);
    const clientBalanceBefore = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;

    assert.equal(vaultBeforeFunding, null);
    assert.equal(clientBalanceBefore, clientStartingBalance);

    await program.methods
      .fundDeal()
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: dealPda,
        mint: usdcMint,
        vaultAuthority: vaultAuthorityPda,
        clientTokenAccount,
        vaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const clientBalanceAfter = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const vaultBalanceAfter = await getAccount(provider.connection, vaultTokenAccount);
    const deal = await program.account.deal.fetch(dealPda);

    assert.equal(
      clientBalanceAfter,
      clientStartingBalance - BigInt(totalAmount.toString()),
    );
    assert.equal(vaultBalanceAfter.amount, BigInt(totalAmount.toString()));
    assert.equal(vaultBalanceAfter.owner.toBase58(), vaultAuthorityPda.toBase58());
    assert.equal(enumKey(deal.status), "funded");
    assert.equal(deal.fundedAmount.toString(), totalAmount.toString());
  });

  await t.test("submit_evidence succeeds and moves the deal into progress", async () => {
    await submitEvidenceForMilestone(0);

    const deal = await program.account.deal.fetch(dealPda);
    const milestone = await program.account.milestone.fetch(milestonePdas[0]);
    const evidencePayload = evidencePayloads[0];

    assert.equal(enumKey(deal.status), "inProgress");
    assert.equal(enumKey(milestone.status), "evidenceSubmitted");
    assert.equal(milestone.evidenceUri, evidencePayload.evidenceUri);
    assert.equal(
      evidenceHashToHex(milestone.evidenceHash),
      evidencePayload.evidenceHashHex,
    );
    assert.equal(milestone.evidenceSummary, evidencePayload.evidenceSummary);
    assert.equal(milestone.attachmentCount, evidencePayload.attachmentCount);
    assert.ok(milestone.lastSubmittedAt.gt(new anchor.BN(0)));
  });

  await t.test("submit_evidence works for additional milestones", async () => {
    await submitEvidenceForMilestone(1);
    await submitEvidenceForMilestone(2);

    const milestoneOne = await program.account.milestone.fetch(milestonePdas[1]);
    const milestoneTwo = await program.account.milestone.fetch(milestonePdas[2]);

    assert.equal(enumKey(milestoneOne.status), "evidenceSubmitted");
    assert.equal(enumKey(milestoneTwo.status), "evidenceSubmitted");
  });

  await t.test("only freelancer can submit evidence", async () => {
    await assert.rejects(
      program.methods
        .submitEvidence(
          1,
          "ipfs://milestonemind/mock-proof-002",
          Array.from(hexToEvidenceHash("cd".repeat(32))),
          "Attempted submission by the wrong actor.",
          1,
        )
        .accounts({
          freelancer: client.publicKey,
          deal: dealPda,
          milestone: milestonePdas[1],
        })
        .rpc(),
    );
  });

  await t.test("approve path stores assessment data and marks the milestone approved", async () => {
    const approvalSummary = "AI assessor approved the milestone with substantial confidence.";
    const approvalHashHex = "11".repeat(32);

    await submitAssessmentForMilestone(
      0,
      "approve",
      9_100,
      7_000,
      approvalHashHex,
      approvalSummary,
    );

    const deal = await program.account.deal.fetch(dealPda);
    const milestone = await program.account.milestone.fetch(milestonePdas[0]);
    const assessment = await program.account.assessment.fetch(assessmentPdas[0]);

    assert.equal(enumKey(deal.status), "inProgress");
    assert.equal(enumKey(milestone.status), "approved");
    assert.equal(assessment.milestone.toBase58(), milestonePdas[0].toBase58());
    assert.equal(assessment.assessor.toBase58(), assessor.publicKey.toBase58());
    assert.equal(enumKey(assessment.decision), "approve");
    assert.equal(assessment.confidenceBps, 9_100);
    assert.equal(assessment.approvedBps, 7_000);
    assert.equal(evidenceHashToHex(assessment.rationaleHash), approvalHashHex);
    assert.equal(assessment.summary, approvalSummary);
    assert.ok(assessment.createdAt.gt(new anchor.BN(0)));
  });

  await t.test("partial release 70% auto-creates freelancer ATA and pays from vault", async () => {
    const freelancerAtaBefore = await provider.connection.getAccountInfo(freelancerTokenAccount);
    const vaultBalanceBefore = (await getAccount(provider.connection, vaultTokenAccount)).amount;

    assert.equal(freelancerAtaBefore, null);
    assert.equal(vaultBalanceBefore, BigInt(totalAmount.toString()));

    await releaseApprovedFundsForMilestone(0);

    const milestone = await program.account.milestone.fetch(milestonePdas[0]);
    const freelancerBalanceAfter = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceAfter = (await getAccount(provider.connection, vaultTokenAccount)).amount;
    const expectedReleaseAmount = BigInt(1_400_000);

    assert.equal(milestone.releasedAmount.toString(), expectedReleaseAmount.toString());
    assert.equal(enumKey(milestone.status), "paidPartial");
    assert.equal(freelancerBalanceAfter, expectedReleaseAmount);
    assert.equal(vaultBalanceAfter, vaultBalanceBefore - expectedReleaseAmount);
  });

  await t.test("double release fails", async () => {
    await assert.rejects(
      releaseApprovedFundsForMilestone(0),
    );
  });

  await t.test("non-approved milestone fails release", async () => {
    await assert.rejects(
      releaseApprovedFundsForMilestone(1),
    );
  });

  await t.test("only assessor can submit assessment", async () => {
    await assert.rejects(
      program.methods
        .submitAssessment(
          2,
          assessmentDecision("hold"),
          6_500,
          0,
          Array.from(hexToEvidenceHash("22".repeat(32))),
          "Unauthorized assessment attempt.",
        )
        .accounts({
          platform: platformPda,
          assessor: client.publicKey,
          deal: dealPda,
          milestone: milestonePdas[2],
          assessment: assessmentPdas[2],
          systemProgram: web3.SystemProgram.programId,
        })
      .rpc(),
    );
  });

  await t.test("hold path marks the milestone on hold", async () => {
    await submitAssessmentForMilestone(
      1,
      "hold",
      6_800,
      0,
      "33".repeat(32),
      "Assessor requires stronger corroborating artifacts before payout.",
    );

    const deal = await program.account.deal.fetch(dealPda);
    const milestone = await program.account.milestone.fetch(milestonePdas[1]);
    const assessment = await program.account.assessment.fetch(assessmentPdas[1]);

    assert.equal(enumKey(deal.status), "inProgress");
    assert.equal(enumKey(milestone.status), "onHold");
    assert.equal(enumKey(assessment.decision), "hold");
    assert.equal(assessment.approvedBps, 0);
  });

  await t.test("cannot submit assessment when milestone is no longer EvidenceSubmitted", async () => {
    await assert.rejects(
      program.methods
        .submitAssessment(
          0,
          assessmentDecision("approve"),
          9_200,
          8_000,
          Array.from(hexToEvidenceHash("44".repeat(32))),
          "This second approval should fail.",
        )
        .accounts({
          platform: platformPda,
          assessor: assessor.publicKey,
          deal: dealPda,
          milestone: milestonePdas[0],
          assessment: assessmentPdas[0],
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([assessor])
        .rpc(),
    );
  });

  await t.test("dispute path marks the milestone and deal disputed", async () => {
    await submitAssessmentForMilestone(
      2,
      "dispute",
      8_400,
      0,
      "55".repeat(32),
      "Assessor found conflicting evidence and raised a dispute.",
    );

    const deal = await program.account.deal.fetch(dealPda);
    const milestone = await program.account.milestone.fetch(milestonePdas[2]);
    const assessment = await program.account.assessment.fetch(assessmentPdas[2]);

    assert.equal(enumKey(deal.status), "disputed");
    assert.equal(enumKey(milestone.status), "inDispute");
    assert.equal(enumKey(assessment.decision), "dispute");
    assert.equal(assessment.approvedBps, 0);
  });

  await t.test("full release 100% works and assessor may trigger it", async () => {
    const secondDealAmount = new anchor.BN(1_000_000);
    const [secondDealPda] = web3.PublicKey.findProgramAddressSync(
      [DEAL_SEED, u64Le(1)],
      program.programId,
    );
    const [secondMilestonePda] = web3.PublicKey.findProgramAddressSync(
      [MILESTONE_SEED, secondDealPda.toBuffer(), u16Le(0)],
      program.programId,
    );
    const [secondAssessmentPda] = web3.PublicKey.findProgramAddressSync(
      [ASSESSMENT_SEED, secondMilestonePda.toBuffer()],
      program.programId,
    );
    const [secondVaultAuthorityPda] = web3.PublicKey.findProgramAddressSync(
      [VAULT_SEED, secondDealPda.toBuffer()],
      program.programId,
    );
    const secondVaultTokenAccount = getAssociatedTokenAddressSync(
      usdcMint,
      secondVaultAuthorityPda,
      true,
    );
    const freelancerBalanceBefore = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;

    await program.methods
      .createDeal(freelancer.publicKey, "Full payout QA cycle", 1, secondDealAmount)
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: secondDealPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .createMilestone(0, "Final acceptance handoff", secondDealAmount)
      .accounts({
        client: client.publicKey,
        deal: secondDealPda,
        milestone: secondMilestonePda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .fundDeal()
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: secondDealPda,
        mint: usdcMint,
        vaultAuthority: secondVaultAuthorityPda,
        clientTokenAccount,
        vaultTokenAccount: secondVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await program.methods
      .submitEvidence(
        0,
        "ipfs://milestonemind/full-payout-proof",
        Array.from(hexToEvidenceHash("77".repeat(32))),
        "Client acceptance package is complete and ready for payout.",
        2,
      )
      .accounts({
        freelancer: freelancer.publicKey,
        deal: secondDealPda,
        milestone: secondMilestonePda,
      })
      .signers([freelancer])
      .rpc();

    await program.methods
      .submitAssessment(
        0,
        assessmentDecision("approve"),
        9_700,
        10_000,
        Array.from(hexToEvidenceHash("88".repeat(32))),
        "Assessor approved the milestone for a full payout.",
      )
      .accounts({
        platform: platformPda,
        assessor: assessor.publicKey,
        deal: secondDealPda,
        milestone: secondMilestonePda,
        assessment: secondAssessmentPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([assessor])
      .rpc();

    await assert.rejects(
      releaseApprovedFundsForMilestone(
        0,
        freelancer.publicKey,
        [freelancer],
        secondDealPda,
        secondMilestonePda,
        secondAssessmentPda,
        secondVaultAuthorityPda,
        secondVaultTokenAccount,
      ),
    );

    await releaseApprovedFundsForMilestone(
      0,
      assessor.publicKey,
      [assessor],
      secondDealPda,
      secondMilestonePda,
      secondAssessmentPda,
      secondVaultAuthorityPda,
      secondVaultTokenAccount,
    );

    const secondMilestone = await program.account.milestone.fetch(secondMilestonePda);
    const vaultBalanceAfter = (await getAccount(
      provider.connection,
      secondVaultTokenAccount,
    )).amount;
    const freelancerBalanceAfter = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;

    assert.equal(secondMilestone.releasedAmount.toString(), secondDealAmount.toString());
    assert.equal(enumKey(secondMilestone.status), "paidFull");
    assert.equal(vaultBalanceAfter, BigInt(0));
    assert.equal(
      freelancerBalanceAfter,
      freelancerBalanceBefore + BigInt(secondDealAmount.toString()),
    );
  });

  await t.test("cannot submit assessment when the deal is no longer InProgress", async () => {
    await assert.rejects(
      program.methods
        .submitAssessment(
          1,
          assessmentDecision("hold"),
          6_900,
          0,
          Array.from(hexToEvidenceHash("66".repeat(32))),
          "This should fail after the deal becomes disputed.",
        )
        .accounts({
          platform: platformPda,
          assessor: assessor.publicKey,
          deal: dealPda,
          milestone: milestonePdas[1],
          assessment: assessmentPdas[1],
          systemProgram: web3.SystemProgram.programId,
        })
        .signers([assessor])
        .rpc(),
    );
  });

  await t.test("resolve only from InDispute", async () => {
    await assert.rejects(
      resolveDisputeForMilestone(0, 5_000),
    );
  });

  await t.test("open dispute by client works for PaidPartial milestone", async () => {
    await openDisputeForMilestone(
      0,
      "Client disputes the remaining payout after partial release.",
    );

    const deal = await program.account.deal.fetch(dealPda);
    const milestone = await program.account.milestone.fetch(milestonePdas[0]);

    assert.equal(enumKey(deal.status), "disputed");
    assert.equal(enumKey(milestone.status), "inDispute");
  });

  await t.test("resolve by admin with 50 split settles the remaining amount", async () => {
    const clientBalanceBefore = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const freelancerBalanceBefore = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceBefore = (await getAccount(
      provider.connection,
      vaultTokenAccount,
    )).amount;

    await resolveDisputeForMilestone(0, 5_000);

    const milestone = await program.account.milestone.fetch(milestonePdas[0]);
    const clientBalanceAfter = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const freelancerBalanceAfter = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceAfter = (await getAccount(
      provider.connection,
      vaultTokenAccount,
    )).amount;
    const freelancerSettlementAmount = BigInt(300_000);
    const clientSettlementAmount = BigInt(300_000);

    assert.equal(enumKey(milestone.status), "resolved");
    assert.equal(milestone.releasedAmount.toString(), "1700000");
    assert.equal(
      freelancerBalanceAfter,
      freelancerBalanceBefore + freelancerSettlementAmount,
    );
    assert.equal(clientBalanceAfter, clientBalanceBefore + clientSettlementAmount);
    assert.equal(
      vaultBalanceAfter,
      vaultBalanceBefore - freelancerSettlementAmount - clientSettlementAmount,
    );
  });

  await t.test("open dispute by freelancer works for OnHold milestone", async () => {
    await openDisputeForMilestone(
      1,
      "Freelancer wants admin review on the held milestone.",
      freelancer.publicKey,
      [freelancer],
    );

    const milestone = await program.account.milestone.fetch(milestonePdas[1]);

    assert.equal(enumKey(milestone.status), "inDispute");
  });

  await t.test("unauthorized admin resolve fails", async () => {
    await assert.rejects(
      resolveDisputeForMilestone(
        1,
        0,
        assessor.publicKey,
        [assessor],
      ),
    );
  });

  await t.test("resolve by admin with 0 split refunds the remaining amount to client", async () => {
    const clientBalanceBefore = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const freelancerBalanceBefore = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceBefore = (await getAccount(
      provider.connection,
      vaultTokenAccount,
    )).amount;

    await resolveDisputeForMilestone(1, 0);

    const milestone = await program.account.milestone.fetch(milestonePdas[1]);
    const clientBalanceAfter = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const freelancerBalanceAfter = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceAfter = (await getAccount(
      provider.connection,
      vaultTokenAccount,
    )).amount;
    const refundedAmount = BigInt(milestoneAmounts[1].toString());

    assert.equal(enumKey(milestone.status), "refunded");
    assert.equal(milestone.releasedAmount.toNumber(), 0);
    assert.equal(clientBalanceAfter, clientBalanceBefore + refundedAmount);
    assert.equal(freelancerBalanceAfter, freelancerBalanceBefore);
    assert.equal(vaultBalanceAfter, vaultBalanceBefore - refundedAmount);
  });

  await t.test("resolve by admin with 100 split pays freelancer the full remaining disputed amount", async () => {
    const clientBalanceBefore = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const freelancerBalanceBefore = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceBefore = (await getAccount(
      provider.connection,
      vaultTokenAccount,
    )).amount;

    await resolveDisputeForMilestone(2, 10_000);

    const milestone = await program.account.milestone.fetch(milestonePdas[2]);
    const clientBalanceAfter = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const freelancerBalanceAfter = (await getAccount(
      provider.connection,
      freelancerTokenAccount,
    )).amount;
    const vaultBalanceAfter = (await getAccount(
      provider.connection,
      vaultTokenAccount,
    )).amount;
    const settlementAmount = BigInt(milestoneAmounts[2].toString());

    assert.equal(enumKey(milestone.status), "resolved");
    assert.equal(milestone.releasedAmount.toString(), milestoneAmounts[2].toString());
    assert.equal(clientBalanceAfter, clientBalanceBefore);
    assert.equal(freelancerBalanceAfter, freelancerBalanceBefore + settlementAmount);
    assert.equal(vaultBalanceAfter, vaultBalanceBefore - settlementAmount);
  });

  await t.test("finalize fails if not all milestones terminal", async () => {
    const finalizeDealTotal = new anchor.BN(1_200_000);
    const finalizeMilestoneAmounts = [
      new anchor.BN(400_000),
      new anchor.BN(600_000),
    ];
    const [finalizeDealPda] = web3.PublicKey.findProgramAddressSync(
      [DEAL_SEED, u64Le(2)],
      program.programId,
    );
    const finalizeMilestonePdas = finalizeMilestoneAmounts.map((_, index) =>
      web3.PublicKey.findProgramAddressSync(
        [MILESTONE_SEED, finalizeDealPda.toBuffer(), u16Le(index)],
        program.programId,
      )[0],
    );
    const finalizeAssessmentPdas = finalizeMilestonePdas.map((milestonePda) =>
      web3.PublicKey.findProgramAddressSync(
        [ASSESSMENT_SEED, milestonePda.toBuffer()],
        program.programId,
      )[0],
    );
    const [finalizeVaultAuthorityPda] = web3.PublicKey.findProgramAddressSync(
      [VAULT_SEED, finalizeDealPda.toBuffer()],
      program.programId,
    );
    const finalizeVaultTokenAccount = getAssociatedTokenAddressSync(
      usdcMint,
      finalizeVaultAuthorityPda,
      true,
    );

    await program.methods
      .createDeal(freelancer.publicKey, "Finalize with vault refund", 2, finalizeDealTotal)
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: finalizeDealPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    for (const [index, amount] of finalizeMilestoneAmounts.entries()) {
      await program.methods
        .createMilestone(index, `Finalize milestone ${index + 1}`, amount)
        .accounts({
          client: client.publicKey,
          deal: finalizeDealPda,
          milestone: finalizeMilestonePdas[index],
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
    }

    await program.methods
      .fundDeal()
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: finalizeDealPda,
        mint: usdcMint,
        vaultAuthority: finalizeVaultAuthorityPda,
        clientTokenAccount,
        vaultTokenAccount: finalizeVaultTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    for (const [index, amount] of finalizeMilestoneAmounts.entries()) {
      await program.methods
        .submitEvidence(
          index,
          `ipfs://milestonemind/finalize-proof-${index + 1}`,
          Array.from(hexToEvidenceHash(`${90 + index}`.repeat(32))),
          `Finalize evidence package ${index + 1} for amount ${amount.toString()}.`,
          2,
        )
        .accounts({
          freelancer: freelancer.publicKey,
          deal: finalizeDealPda,
          milestone: finalizeMilestonePdas[index],
        })
        .signers([freelancer])
        .rpc();
    }

    await program.methods
      .submitAssessment(
        0,
        assessmentDecision("approve"),
        9_500,
        10_000,
        Array.from(hexToEvidenceHash("99".repeat(32))),
        "Admin approved the first finalize milestone for full payout.",
      )
      .accounts({
        platform: platformPda,
        assessor: assessor.publicKey,
        deal: finalizeDealPda,
        milestone: finalizeMilestonePdas[0],
        assessment: finalizeAssessmentPdas[0],
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([assessor])
      .rpc();

    await program.methods
      .submitAssessment(
        1,
        assessmentDecision("approve"),
        9_600,
        10_000,
        Array.from(hexToEvidenceHash("aa".repeat(32))),
        "Admin approved the second finalize milestone for full payout.",
      )
      .accounts({
        platform: platformPda,
        assessor: assessor.publicKey,
        deal: finalizeDealPda,
        milestone: finalizeMilestonePdas[1],
        assessment: finalizeAssessmentPdas[1],
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([assessor])
      .rpc();

    await program.methods
      .releaseApprovedFunds(0)
      .accounts({
        platform: platformPda,
        authority: client.publicKey,
        deal: finalizeDealPda,
        milestone: finalizeMilestonePdas[0],
        assessment: finalizeAssessmentPdas[0],
        mint: usdcMint,
        vaultAuthority: finalizeVaultAuthorityPda,
        vaultTokenAccount: finalizeVaultTokenAccount,
        freelancer: freelancer.publicKey,
        freelancerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await assert.rejects(
      finalizeDealFor({
        deal: finalizeDealPda,
        milestoneAccounts: finalizeMilestonePdas,
        vaultAuthority: finalizeVaultAuthorityPda,
        vaultTokenAccount: finalizeVaultTokenAccount,
      }),
    );

    await assert.rejects(
      finalizeDealFor({
        deal: finalizeDealPda,
        milestoneAccounts: finalizeMilestonePdas,
        vaultAuthority: finalizeVaultAuthorityPda,
        vaultTokenAccount: finalizeVaultTokenAccount,
        clientSigner: freelancer.publicKey,
        clientToken: freelancerTokenAccount,
        signers: [freelancer],
      }),
    );

    await program.methods
      .releaseApprovedFunds(1)
      .accounts({
        platform: platformPda,
        authority: assessor.publicKey,
        deal: finalizeDealPda,
        milestone: finalizeMilestonePdas[1],
        assessment: finalizeAssessmentPdas[1],
        mint: usdcMint,
        vaultAuthority: finalizeVaultAuthorityPda,
        vaultTokenAccount: finalizeVaultTokenAccount,
        freelancer: freelancer.publicKey,
        freelancerTokenAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: web3.SystemProgram.programId,
      })
      .signers([assessor])
      .rpc();

    const clientBalanceBeforeFinalize = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const vaultBalanceBeforeFinalize = (await getAccount(
      provider.connection,
      finalizeVaultTokenAccount,
    )).amount;

    assert.equal(vaultBalanceBeforeFinalize, BigInt(200_000));

    await finalizeDealFor({
      deal: finalizeDealPda,
      milestoneAccounts: finalizeMilestonePdas,
      vaultAuthority: finalizeVaultAuthorityPda,
      vaultTokenAccount: finalizeVaultTokenAccount,
    });

    const finalizedDeal = await program.account.deal.fetch(finalizeDealPda);
    const clientBalanceAfterFinalize = (await getAccount(
      provider.connection,
      clientTokenAccount,
    )).amount;
    const vaultBalanceAfterFinalize = (await getAccount(
      provider.connection,
      finalizeVaultTokenAccount,
    )).amount;

    assert.equal(enumKey(finalizedDeal.status), "completed");
    assert.equal(finalizedDeal.settledMilestones, 2);
    assert.equal(clientBalanceAfterFinalize, clientBalanceBeforeFinalize + BigInt(200_000));
    assert.equal(vaultBalanceAfterFinalize, BigInt(0));
  });

  await t.test("cancel draft success", async () => {
    const [cancelDealPda] = web3.PublicKey.findProgramAddressSync(
      [DEAL_SEED, u64Le(3)],
      program.programId,
    );

    await program.methods
      .createDeal(freelancer.publicKey, "Cancelable draft deal", 1, new anchor.BN(500_000))
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: cancelDealPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await cancelDraftDealFor(cancelDealPda);

    const cancelledDeal = await program.account.deal.fetch(cancelDealPda);

    assert.equal(enumKey(cancelledDeal.status), "cancelled");
    assert.equal(cancelledDeal.fundedAmount.toNumber(), 0);
  });

  await t.test("cannot submit evidence before deal funding", async () => {
    const [unfundedDealPda] = web3.PublicKey.findProgramAddressSync(
      [DEAL_SEED, u64Le(4)],
      program.programId,
    );

    await program.methods
      .createDeal(freelancer.publicKey, "Unfunded design sprint", 1, new anchor.BN(1_000_000))
      .accounts({
        platform: platformPda,
        client: client.publicKey,
        deal: unfundedDealPda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    const [unfundedMilestonePda] = web3.PublicKey.findProgramAddressSync(
      [MILESTONE_SEED, unfundedDealPda.toBuffer(), u16Le(0)],
      program.programId,
    );

    await program.methods
      .createMilestone(0, "Unfunded milestone", new anchor.BN(1_000_000))
      .accounts({
        client: client.publicKey,
        deal: unfundedDealPda,
        milestone: unfundedMilestonePda,
        systemProgram: web3.SystemProgram.programId,
      })
      .rpc();

    await assert.rejects(
      program.methods
        .submitEvidence(
          0,
          "ipfs://milestonemind/unfunded",
          Array.from(hexToEvidenceHash("ef".repeat(32))),
          "This should be rejected before funding.",
          1,
        )
        .accounts({
          freelancer: freelancer.publicKey,
          deal: unfundedDealPda,
          milestone: unfundedMilestonePda,
        })
        .signers([freelancer])
        .rpc(),
    );
  });
});
