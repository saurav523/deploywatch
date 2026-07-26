import http from "http";
import { createApp } from "./app";
import { connectDb } from "./config/db";
import { initSockets } from "./sockets";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { startSimulatorJob } from "./jobs/simulator.job";
import { User } from "./models/User";

async function main() {
  await connectDb();

  const app = createApp();
  const httpServer = http.createServer(app);
  initSockets(httpServer);

  // Single-org demo: discover the seeded org and start the cluster
  // simulator for it. In production this loop would instead start one
  // ingestion worker per registered cluster (ARCHITECTURE.md §3.3).
  const anyUser = await User.findOne();
  if (anyUser) {
    startSimulatorJob(anyUser.orgId);
  } else {
    logger.warn("No seeded org found — run `npm run seed` to populate demo data and enable live updates");
  }

  httpServer.listen(env.port, () => {
    logger.info({ port: env.port }, "DeployWatch API listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
