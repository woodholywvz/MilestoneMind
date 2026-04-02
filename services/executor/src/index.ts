import { loadExecutorConfig } from "./env/config.js";
import { createAppServer } from "./http/server.js";

const config = loadExecutorConfig();
const server = createAppServer({ config });

server.listen(config.executorPort, config.executorHost, () => {
  console.log(
    `[executor] req=startup deal=- milestone=- listening on http://${config.executorHost}:${config.executorPort}`,
  );
});
