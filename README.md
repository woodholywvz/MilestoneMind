# MilestoneMind

MilestoneMind is a Solana-first product scaffold for milestone-driven execution flows with an Anchor program, thin web shell, and off-chain services.

## Repository map

- `programs/milestone_mind`: Anchor program for deal, milestone, escrow, and settlement-critical state.
- `apps/web`: Next.js shell for future wallet and operator UX.
- `services/ai`: FastAPI planning/reasoning boundary.
- `services/executor`: Node/TypeScript relayer-executor boundary.
- `packages/shared`: shared TypeScript types and on-chain enum mirrors.
- `scripts`: root helper scripts for local development and demo bootstrap.

## Prerequisites

- Node.js 24+
- npm 11+
- Python 3.11+
- Rust toolchain
- Solana CLI
- Anchor CLI

## Install

```bash
npm install
python -m pip install -r services/ai/requirements.txt -r services/ai/requirements-dev.txt
```

## Web dashboard

Run the read-only web dashboard:

```bash
npm run dev:web
```

Production run after build:

```bash
npm run build --workspace @milestone-mind/web
npm run start --workspace @milestone-mind/web
```

Web environment variables:

- `NEXT_PUBLIC_RPC_URL` default `http://127.0.0.1:8899`
- `NEXT_PUBLIC_PROGRAM_ID` default `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x`
- `NEXT_PUBLIC_CLUSTER` one of `localnet`, `devnet`, `testnet`, `mainnet-beta`
- `NEXT_PUBLIC_EXECUTOR_BASE_URL` default `http://127.0.0.1:8080`

Routes:

- `/` hero, wallet connect, and `All Deals` list from on-chain `Deal` accounts
- `/create` wallet-driven create flow for `create_deal`, `create_milestone`, and `fund_deal`
- `/deals/[dealPubkey]` deal summary, timeline, freelancer evidence submit, assessor/admin assessment panel, settlement actions, and finalize/cancel controls

Create flow:

1. Connect a wallet in the web app.
2. Open `/create`.
3. Enter the freelancer pubkey, deal title, and one or more milestones.
4. Review the total required mock USDC amount and connected wallet balance.
5. Submit the sequential flow:
   - `create_deal`
   - `create_milestone` for each row
   - `fund_deal`
6. Track signatures in the progress panel, then redirect to the new deal detail page.

Assessment panel flow:

1. Connect a wallet that matches `platform.assessor` or `platform.admin`.
2. Open a deal detail page with a milestone in `EvidenceSubmitted`.
3. Use `Dry assess` to call the executor without writing on-chain state.
4. Review `decision`, `confidenceBps`, `approvedBps`, `ruleTrace`, and `rationaleHashHex`.
5. Use `Commit assess` to call the executor commit endpoint.
6. After commit, the page refreshes and the on-chain assessment summary appears on the milestone.

Settlement and lifecycle actions in the UI:

- client:
  - `Release approved funds`
  - `Open dispute`
  - `Finalize deal`
  - `Cancel draft deal`
- freelancer:
  - `Submit evidence`
  - `Open dispute`
- assessor:
  - `Dry assess`
  - `Commit assess`
  - optionally `Release approved funds`
- admin:
  - `Dry assess`
  - `Resolve dispute`

Timeline UX:

1. Deal detail renders a lifecycle timeline from account state only.
2. The timeline marks deal created, funded, evidence submitted, assessment committed, funds released, dispute opened/resolved, and deal finalized.
3. No indexer is required; the view is reconstructed from `Deal`, `Milestone`, and `Assessment` accounts.

## AI service

Run the AI service:

```bash
npm run dev:ai
```

Manual equivalent:

```bash
cd services/ai
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

AI environment variables:

- `AI_HOST`
- `AI_PORT`
- `AI_ASSESSMENT_ENGINE_VERSION` default `rules-v1`
- `AI_ENABLE_LLM` enables the semantic OpenAI layer; default `0`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL` optional override
- `AI_OPENAI_MODEL` default `gpt-5.4-mini`
- `AI_OPENAI_EMBEDDING_MODEL` default `text-embedding-3-small`
- `AI_OPENAI_REASONING_EFFORT` default `medium`
- `AI_OPENAI_TIMEOUT_SECONDS` default `45`
- `AI_RAG_TOP_K` default `4`
- `AI_MAX_ATTACHMENT_BYTES` default `2000000`
- `AI_IPFS_GATEWAY` default `https://ipfs.io/ipfs/`

Assessment pipeline:

1. Deterministic rules engine always runs first.
2. If `AI_ENABLE_LLM=1` and `OPENAI_API_KEY` is set, the service runs a semantic OpenAI assessor on top.
3. The semantic layer uses:
   - `gpt-5.4-mini` for structured semantic assessment
   - `text-embedding-3-small` for rubric retrieval / embedding similarity
   - attachment ingestion for image, PDF, and text-like evidence URIs
4. Final output is synthesized conservatively, so deterministic guardrails remain in force.

Sample assessment request:

```json
{
  "dealPubkey": "Deal11111111111111111111111111111111111111111",
  "milestonePubkey": "Mile1111111111111111111111111111111111111111",
  "milestoneIndex": 0,
  "dealTitle": "Production landing page rollout",
  "milestoneTitle": "Finalize deployment and acceptance package",
  "milestoneAmount": 7000000,
  "evidenceUri": "ipfs://milestonemind/final-package-v1",
  "evidenceHashHex": "abababababababababababababababababababababababababababababababab",
  "evidenceSummary": "Final delivered production package accepted by the client. Complete invoice bundle, screenshots, rollout notes, and deployment confirmation are attached for the milestone review.",
  "attachmentCount": 3
}
```

Sample assessment response:

```json
{
  "decision": "approve",
  "confidenceBps": 9000,
  "approvedBps": 10000,
  "summary": "Evidence package is strong and supports a full approval.",
  "rationaleHashHex": "7b5faff8f8bd2c80ff725abe9b17b43ec3f5240a3fdf9cd9c2c40732b6a4fd3b",
  "ruleTrace": [
    "engine: rules-v1 (deterministic rules path)",
    "summary-length: 178 chars -> +40",
    "attachments: 3 -> +15",
    "strong-keywords: accepted, complete, delivered, final, invoice, production -> +30",
    "suspicious-keywords: none -> -0",
    "score: 85",
    "decision: approve with approvedBps=10000 and confidenceBps=9000"
  ],
  "engineVersion": "rules-v1"
}
```

To enable the semantic layer locally:

```bash
AI_ENABLE_LLM=1
OPENAI_API_KEY=your_key_here
AI_OPENAI_MODEL=gpt-5.4-mini
AI_OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

## Executor service

Run the executor service:

```bash
npm run dev:executor
```

Executor environment variables:

- `EXECUTOR_HOST`
- `EXECUTOR_PORT`
- `SOLANA_RPC_URL`
- `EXECUTOR_AI_BASE_URL` default `http://127.0.0.1:8000`
- `EXECUTOR_KEYPAIR_PATH` or `ANCHOR_WALLET`
- `MILESTONE_MIND_PROGRAM_ID` default `Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkgMQHG7d43x`

For `assess:commit`, the executor wallet must match `platform.assessor`.

Dry-run CLI examples:

```bash
npm run executor:assess:dry -- --deal-id 0 --milestone-index 0
```

```bash
pnpm --filter @milestone-mind/executor assess:dry -- --deal-id 0 --milestone-index 0
```

Commit CLI examples:

```bash
npm run executor:assess:commit -- --deal-id 0 --milestone-index 0
```

```bash
pnpm --filter @milestone-mind/executor assess:commit -- --deal-id 0 --milestone-index 0
```

Dry-run flow:

1. Derive the `Deal` PDA from `deal_id`.
2. Derive the `Milestone` PDA from the deal PDA and `milestone_index`.
3. Read the on-chain deal and milestone accounts through the Anchor client.
4. Refuse execution unless the milestone status is `EvidenceSubmitted`.
5. Build the shared `/assess` payload and validate it with the shared zod schema.
6. Call the AI service and print the parsed assessment response.

Commit flow:

1. Read `PlatformConfig`, `Deal`, and `Milestone`.
2. Refuse execution unless the milestone status is `EvidenceSubmitted`.
3. Refuse execution unless the executor wallet matches `platform.assessor`.
4. Call the AI service and parse the shared assessment response.
5. Submit `submit_assessment` on-chain.
6. Print the transaction signature and the final milestone status.

Executor HTTP contract:

- `GET /health`
- `POST /assess/dry`
- `POST /assess/commit`

Assessment request body:

```json
{
  "dealId": 0,
  "milestoneIndex": 0
}
```

Dry response shape:

```json
{
  "requestId": "5af17e2c",
  "dealId": 0,
  "milestoneIndex": 0,
  "dealPubkey": "9Z6qJDPoZPf8ePU7EKA2USZ1NKXuE2QQ4CzngHippD5K",
  "milestonePubkey": "2xByv61xhvrurZGk1PK2cKL3v94qBrLgN2oYvjsWMphi",
  "assessmentPubkey": "3V8ptmXxR6K6mW6eP6rG2Xx2bGZ3qM5u5b3o7sM3e7Nf",
  "verdict": {
    "decision": "approve",
    "confidenceBps": 9100,
    "approvedBps": 7000,
    "summary": "Evidence is credible and sufficient for a partial approval.",
    "rationaleHashHex": "abababababababababababababababababababababababababababababababab",
    "ruleTrace": [
      "engine: rules-v1",
      "decision: approve"
    ],
    "engineVersion": "rules-v1+openai-v1"
  }
}
```

Commit response adds:

- `txSignature`
- `milestoneStatus`

## One-Pass Demo Guide

For the full UI demo, use separate terminals:

1. `npm run demo:validator`
2. `npm run dev:ai`
3. `npm run dev:executor`
4. `npm run dev:web`

Then in the browser:

1. Connect the demo client wallet and open `/create`.
2. Create and fund a deal with 1-2 milestones.
3. Switch to the freelancer wallet on the deal page and submit evidence.
4. Switch to the assessor wallet and run `Dry assess`, then `Commit assess`.
5. Switch to the client wallet and release approved funds.
6. If needed, open a dispute as client or freelancer.
7. Switch to the admin wallet and resolve the dispute with a split preview.
8. Switch back to the client wallet and finalize the deal once all milestones are terminal.

Expected UI checkpoints:

- the deal card appears on the dashboard after create+fund
- milestone cards show current evidence, assessment, and settlement controls by role
- the timeline moves forward as state changes on-chain
- finalize becomes available only after every milestone reaches `PaidFull`, `Resolved`, or `Refunded`

## Demo Roles

- `client`: funds escrow, can release approved funds, open disputes, cancel draft deals, and finalize completed deals
- `freelancer`: submits milestone evidence and can open disputes
- `assessor`: runs AI dry-run and commit assessment, and may release approved funds
- `admin`: resolves disputes and can inspect assessment dry-runs

## End-to-End Demo Script

`demo:e2e` is the CLI happy-path runner. It expects:

- a fresh local validator already running
- the AI service already running

Command:

```bash
npm run demo:e2e
```

What it does:

1. creates demo wallets
2. bootstraps a mock 6-decimal USDC mint
3. funds the demo client wallet
4. initializes platform if needed
5. creates a demo deal and milestones
6. funds escrow
7. submits evidence as the freelancer
8. commits assessment via the executor assessment logic
9. releases funds
10. finalizes the deal

The script prints every step and each transaction signature.

## Local validator

Start a fresh validator in a dedicated terminal:

```bash
npm run demo:validator
```

Then point Solana/Anchor at localnet:

```bash
solana config set --url http://127.0.0.1:8899
```

Create demo wallets and fund them with SOL on localnet:

```bash
npm run demo:create-wallets
```

## Mock USDC bootstrap

Create a 6-decimal mock mint, create the bootstrap ATA for the mint authority wallet, mint demo tokens, and save the mint address:

```bash
npm run demo:bootstrap-mint
```

After that, mint mock USDC to the demo client wallet:

```bash
npm run demo:fund-client
```

The scripts write:

- `MOCK_USDC_MINT`
- `MOCK_USDC_CLIENT_ATA`
- `MOCK_USDC_DECIMALS`
- `MOCK_USDC_BOOTSTRAP_AMOUNT`
- `DEMO_ADMIN_KEYPAIR`
- `DEMO_CLIENT_KEYPAIR`
- `DEMO_FREELANCER_KEYPAIR`
- `DEMO_ASSESSOR_KEYPAIR`
- `DEMO_CLIENT_ATA`

You can override the defaults with:

- `SOLANA_RPC_URL`
- `DEMO_ENV_FILE`
- `ANCHOR_WALLET` or `DEMO_MINT_AUTHORITY_KEYPAIR`
- `MOCK_USDC_AMOUNT`
- `MOCK_USDC_ENV_FILE`

## On-chain flow

Build and sync the IDL:

```bash
npm run anchor:build
```

Run the Anchor tests:

```bash
npm run anchor:test
```

Current funding flow:

1. Initialize platform with the mock USDC mint as `usdc_mint`.
2. Create a deal in `Draft`.
3. Create milestones for the deal.
4. Optionally call `cancel_draft_deal()` while the deal is still unfunded.
5. Call `fund_deal()`.
6. Submit evidence as the freelancer.
7. Submit an approve assessment as the whitelisted assessor.
8. Call `release_approved_funds()` to pay the freelancer from escrow.
9. Optionally call `open_dispute()` and `resolve_dispute()` on the unpaid remainder.
10. Call `finalize_deal()` after every milestone becomes terminal.

`fund_deal()` transfers exactly `deal.total_amount` from the client ATA into the program-controlled vault ATA for the PDA owner derived from `[b"vault", deal]`. The vault ATA is created automatically if needed.

Required accounts for `fund_deal()`:

- `platform`
- `deal`
- `mint`
- `client`
- `client_token_account` as the client's ATA for the mint
- `vault_authority` PDA derived from `[b"vault", deal]`
- `vault_token_account` as the ATA for `vault_authority`

Release flow:

1. `submit_assessment()` must have created an approve assessment for the milestone.
2. `release_approved_funds()` can be called by the `client` or `platform.assessor`.
3. Funds move from the deal vault ATA to the freelancer ATA for the same mint.
4. If the freelancer ATA does not exist yet, the instruction creates it automatically.

Release formula:

```text
release_amount = milestone.amount * approved_bps / 10000
```

Release outcomes:

- `approved_bps == 10000` -> `milestone.status = PaidFull`
- `approved_bps < 10000` -> `milestone.status = PaidPartial`

`PaidPartial` means the approved portion was paid out to the freelancer, while the remainder stays in the deal vault for later dispute handling or manual resolution. This commit does not finalize the deal or close vault accounts automatically.

Dispute flow:

1. `open_dispute()` can be called by the `client` or the `freelancer`.
2. Allowed milestone statuses for `open_dispute()`:
   - `Approved`
   - `OnHold`
   - `PaidPartial`
3. `open_dispute()` moves the milestone to `InDispute` and the deal to `Disputed`.
4. `resolve_dispute()` can be called only by `platform.admin`.
5. Settlement is applied only to the unpaid remainder of the milestone.

Settlement math:

```text
remaining = milestone.amount - milestone.released_amount
freelancer_amount = remaining * freelancer_split_bps / 10000
client_amount = remaining - freelancer_amount
```

Settlement outcomes:

- if `freelancer_amount == 0` and `milestone.released_amount == 0` before settlement -> `milestone.status = Refunded`
- otherwise -> `milestone.status = Resolved`

`resolve_dispute()` auto-creates ATA accounts for both the freelancer and the client when needed. The freelancer transfer increases `milestone.released_amount`; the client refund does not.

Finalize flow:

1. `finalize_deal()` can be called only by the deal `client`.
2. Allowed deal statuses for finalization:
   - `InProgress`
   - `Disputed`
3. Every milestone account for the deal must be passed to the instruction in order and must be terminal:
   - `PaidFull`
   - `Resolved`
   - `Refunded`
4. If the deal vault still has tokens left, `finalize_deal()` refunds the full remainder to the client ATA.
5. After finalization:
   - `deal.status = Completed`
   - `deal.settled_milestones = deal.milestone_count`

## Full Demo Flow

From zero on localnet:

1. `npm install`
2. `npm run demo:validator`
3. `solana config set --url http://127.0.0.1:8899`
4. `npm run demo:create-wallets`
5. `npm run demo:bootstrap-mint`
6. `npm run demo:fund-client`
7. `npm run anchor:build`
8. `npm run anchor:test`

What this prepares:

- a running local validator
- demo admin/client/freelancer/assessor wallets
- a mock USDC mint with 6 decimals
- funded demo client wallet ready for creating and funding deals

Current deal lifecycle:

- `Draft`
- `Cancelled`
- `Funded`
- `InProgress`
- `Disputed`
- `Completed`

## Root scripts

```bash
npm run dev:web
npm run dev:ai
npm run dev:executor
npm run executor:assess:dry -- --deal-id 0 --milestone-index 0
npm run executor:assess:commit -- --deal-id 0 --milestone-index 0
npm run build
npm run lint
npm run test
npm run anchor:build
npm run anchor:test
npm run demo:validator
npm run demo:create-wallets
npm run demo:bootstrap-mint
npm run demo:fund-client
npm run demo:e2e
```
