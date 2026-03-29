import process from "node:process";
import { createAppServer } from "./server.js";

const host = process.env.EXECUTOR_HOST ?? "0.0.0.0";
const rawPort = process.env.EXECUTOR_PORT ?? "8080";
const port = Number.parseInt(rawPort, 10);

if (Number.isNaN(port)) {
  throw new Error(`Invalid EXECUTOR_PORT value: ${rawPort}`);
}

const server = createAppServer();

server.listen(port, host, () => {
  console.log(`Executor listening on http://${host}:${port}`);
});
