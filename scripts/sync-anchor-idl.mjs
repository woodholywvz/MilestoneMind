import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
const sourcePath = resolve(repoRoot, "target", "idl", "milestone_mind.json");
const destinationPath = resolve(
  repoRoot,
  "packages",
  "shared",
  "idl",
  "milestone_mind.json",
);

if (!existsSync(sourcePath)) {
  throw new Error(
    `IDL not found at ${sourcePath}. Run \`anchor build\` before syncing the IDL.`,
  );
}

mkdirSync(dirname(destinationPath), { recursive: true });
copyFileSync(sourcePath, destinationPath);

console.log(`Copied IDL to ${destinationPath}`);
