import assert from "node:assert/strict";
import test from "node:test";

import * as anchor from "@coral-xyz/anchor";
import { web3 } from "@coral-xyz/anchor";

const PLATFORM_SEED = Buffer.from("platform");
const DEAL_SEED = Buffer.from("deal");
const MILESTONE_SEED = Buffer.from("milestone");

function u64Le(value: number | bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

function u16Le(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value);
  return buffer;
}

function enumKey(value: Record<string, unknown>): string {
  return Object.keys(value)[0] ?? "";
}

test("milestone_mind happy path", async (t) => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.MilestoneMind as anchor.Program<anchor.Idl>;
  const client = provider.wallet as anchor.Wallet;
  const admin = client.publicKey;
  const assessor = web3.Keypair.generate().publicKey;
  const usdcMint = web3.Keypair.generate().publicKey;
  const freelancer = web3.Keypair.generate().publicKey;
  const dealTitle = "Launch landing page";
  const milestoneTitles = [
    "Draft wireframes",
    "Ship responsive UI",
    "Polish analytics hooks",
  ];
  const milestoneAmounts = [
    new anchor.BN(2_000),
    new anchor.BN(3_000),
    new anchor.BN(5_000),
  ];
  const totalAmount = milestoneAmounts.reduce(
    (sum, amount) => sum.add(amount),
    new anchor.BN(0),
  );

  const [platformPda] = web3.PublicKey.findProgramAddressSync(
    [PLATFORM_SEED],
    program.programId,
  );

  await program.methods
    .initializePlatform(admin, assessor, usdcMint)
    .accounts({
      payer: client.publicKey,
      platform: platformPda,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();

  await t.test("initialize platform works", async () => {
    const platform = await program.account.platformConfig.fetch(platformPda);

    assert.equal(platform.admin.toBase58(), admin.toBase58());
    assert.equal(platform.assessor.toBase58(), assessor.toBase58());
    assert.equal(platform.usdcMint.toBase58(), usdcMint.toBase58());
    assert.equal(platform.nextDealId.toNumber(), 0);
    assert.equal(typeof platform.bump, "number");
  });

  const [dealPda] = web3.PublicKey.findProgramAddressSync(
    [DEAL_SEED, u64Le(0)],
    program.programId,
  );

  await program.methods
    .createDeal(freelancer, dealTitle, milestoneTitles.length, totalAmount)
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
    assert.equal(deal.freelancer.toBase58(), freelancer.toBase58());
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
});
