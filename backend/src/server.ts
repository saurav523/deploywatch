import http from "http";

import { createApp } from "./app";
import { connectDb } from "./config/db";
import { initSockets } from "./sockets";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { startSimulatorJob } from "./jobs/simulator.job";
import { User } from "./models/User";
import { seedDatabase } from "./seed/seed";

async function main() {
  await connectDb();

  // Automatically create demo data if database is empty.
  const userCount = await User.countDocuments();

  if (userCount === 0) {
    logger.info("No users found. Creating demo data...");
    await seedDatabase();
    logger.info("Demo data created successfully.");
  }

  const app = createApp();

  const httpServer = http.createServer(app);

  initSockets(httpServer);

  // Find seeded user and start simulator
  const anyUser = await User.findOne();

  if (anyUser) {
    startSimulatorJob(anyUser.orgId);
  } else {
    logger.warn("No seeded organization found.");
  }

  httpServer.listen(env.port, () => {
    logger.info(
      { port: env.port },
      "DeployWatch API listening"
    );
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
