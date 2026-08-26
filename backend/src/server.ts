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

  // Automatically create demo data if the database is empty.
  let anyUser = await User.findOne();

  if (!anyUser) {
    logger.info("No users found — seeding demo data...");
    await seedDatabase();
    anyUser = await User.findOne();
  }

  const app = createApp();
  const httpServer = http.createServer(app);
  initSockets(httpServer);

  if (anyUser) {
    startSimulatorJob(anyUser.orgId);
  } else {
    logger.error("No user found after seeding");
  }

  httpServer.listen(env.port, () => {
    logger.info({ port: env.port }, "DeployWatch API listening");
  });
}

main().catch((err) => {
  logger.error({ err }, "Fatal startup error");
  process.exit(1);
});
