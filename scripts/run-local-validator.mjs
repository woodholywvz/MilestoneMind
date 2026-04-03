import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { defaultDemoEnvFile, readEnvFile, repoRoot } from "./demo-utils.mjs";

const demoEnv = readEnvFile(defaultDemoEnvFile);
const ledgerPath = resolve(
  repoRoot,
  process.env.DEMO_VALIDATOR_LEDGER ?? demoEnv.DEMO_VALIDATOR_LEDGER ?? "demo-data/validator-ledger",
);
const args = ["--reset", "--ledger", ledgerPath];

console.log(`Starting local validator with ledger: ${ledgerPath}`);

const child = spawn("solana-test-validator", args, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
