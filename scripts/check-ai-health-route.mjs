import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mainPath = path.resolve(__dirname, "../services/ai/app/main.py");
const source = fs.readFileSync(mainPath, "utf8");

const hasHealthRoute = /@app\.get\(["']\/health["']\)/.test(source);
const hasStatus = /["']status["']\s*:\s*["']ok["']/.test(source);
const hasService = /["']service["']\s*:\s*["']ai["']/.test(source);

if (!hasHealthRoute || !hasStatus || !hasService) {
  throw new Error("FastAPI health route contract is missing from services/ai/app/main.py");
}

console.log("AI health route contract found.");
