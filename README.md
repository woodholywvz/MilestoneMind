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

## Local validator

Start a fresh validator in a dedicated terminal:

```bash
solana-test-validator --reset
```

Then point Solana/Anchor at localnet:

```bash
solana config set --url http://127.0.0.1:8899
```

## Mock USDC bootstrap

Create a 6-decimal mock mint, create the client ATA, mint demo tokens to the current wallet, and save the mint address into `.env.localnet`:

```bash
npm run demo:bootstrap-mint
```

The script writes:

- `MOCK_USDC_MINT`
- `MOCK_USDC_CLIENT_ATA`
- `MOCK_USDC_DECIMALS`
- `MOCK_USDC_BOOTSTRAP_AMOUNT`

You can override the defaults with:

- `SOLANA_RPC_URL`
- `ANCHOR_WALLET` or `DEMO_CLIENT_KEYPAIR`
- `MOCK_USDC_AMOUNT`
- `MOCK_USDC_ENV_FILE`

## On-chain flow

Build and sync the IDL:

```bash
npm run anchor:build
```

Run the Anchor tests:

```bash
anchor test
```

Current funding flow:

1. Initialize platform with the mock USDC mint as `usdc_mint`.
2. Create a deal in `Draft`.
3. Create milestones for the deal.
4. Call `fund_deal()`.

`fund_deal()` transfers exactly `deal.total_amount` from the client ATA into the program-controlled vault ATA for the PDA owner derived from `[b"vault", deal]`. The vault ATA is created automatically if needed.

Required accounts for `fund_deal()`:

- `platform`
- `deal`
- `mint`
- `client`
- `client_token_account` as the client's ATA for the mint
- `vault_authority` PDA derived from `[b"vault", deal]`
- `vault_token_account` as the ATA for `vault_authority`

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
npm run demo:bootstrap-mint
```
