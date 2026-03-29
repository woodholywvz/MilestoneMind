import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serviceDir = path.resolve(__dirname, "../services/ai");
const host = process.env.AI_HOST ?? "0.0.0.0";
const port = process.env.AI_PORT ?? "8000";

const candidates = [
  { command: "python", prefix: [] },
  { command: "python3", prefix: [] },
  { command: "py", prefix: ["-3"] }
];

function resolvePython() {
  for (const candidate of candidates) {
    const probe = spawnSync(candidate.command, [...candidate.prefix, "--version"], {
      stdio: "ignore"
    });

    if (probe.status === 0) {
      return candidate;
    }
  }

  throw new Error(
    "Python 3.11+ was not found. Install Python and dependencies from services/ai/requirements*.txt before running npm run dev:ai."
  );
}

const python = resolvePython();
const child = spawn(
  python.command,
  [
    ...python.prefix,
    "-m",
    "uvicorn",
    "app.main:app",
    "--host",
    host,
    "--port",
    port,
    "--reload"
  ],
  {
    cwd: serviceDir,
    stdio: "inherit",
    env: process.env
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
