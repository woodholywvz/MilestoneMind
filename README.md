# MilestoneMind

MilestoneMind is a Solana-first product scaffold for milestone-driven execution flows. This first commit sets up the repository boundaries, local tooling, and service interfaces without introducing business logic.

## High-level architecture

- `programs/milestone_mind`: Anchor program skeleton for on-chain state transitions.
- `apps/web`: Next.js web shell for future user-facing workflows.
- `services/ai`: FastAPI service boundary for planning, reasoning, and orchestration support.
- `services/executor`: Node/TypeScript relayer-executor boundary for signed execution and off-chain coordination.
- `packages/shared`: shared TypeScript types and environment primitives for off-chain packages.
- `docs`: architecture notes and sequence diagrams.
- `scripts`: local helper scripts for consistent root-level commands.

## Service map

- Web app: `http://localhost:3000`
- AI service health: `http://localhost:8000/health`
- Executor health: `http://localhost:8080/health`
- Anchor program: built with `anchor build` from the repository root

## Local run

### Prerequisites

- Node.js 24+
- npm 11+
- Python 3.11+ with `pip`
- Rust toolchain, Solana CLI, and Anchor CLI for on-chain builds

### Install

```bash
npm install
python -m pip install -r services/ai/requirements.txt -r services/ai/requirements-dev.txt
```

### Development commands

```bash
npm run dev:web
npm run dev:ai
npm run dev:executor
```

### Validation commands

```bash
npm run lint
npm run test
npm run build
npm run anchor:build
```

## Notes

- Root scripts are the canonical entrypoint for local development.
- The AI service uses FastAPI and exposes a health route immediately.
- The executor service uses the Node standard library to keep the first commit minimal.
- The Anchor program contains only a no-op initializer so the workspace is buildable without business logic.
