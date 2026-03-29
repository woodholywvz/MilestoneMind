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
npm run build
npm run lint
npm run test
npm run anchor:build
npm run anchor:test
npm run demo:bootstrap-mint
```
