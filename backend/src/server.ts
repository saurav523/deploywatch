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
  try {
    // 1. Connect to MongoDB
    await connectDb();

    logger.info("Database connected");

    // 2. Check whether demo users already exist
    let anyUser = await User.findOne();

    // 3. If database is empty, create demo data
    if (!anyUser) {
      logger.info("No users found — creating demo data...");

      await seedDatabase();

      // Find the newly-created user
      anyUser = await User.findOne();

      if (anyUser) {
        logger.info(
          { orgId: anyUser.orgId.toString() },
          "Demo data created successfully"
        );
      }
    } else {
      logger.info(
        { orgId: anyUser.orgId.toString() },
        "Existing database found — skipping seed"
      );
    }

    // 4. Create Express application
    const app = createApp();

    // 5. Create HTTP server
    const httpServer = http.createServer(app);

    // 6. Initialize WebSockets
    initSockets(httpServer);

    // 7. Start simulator
    if (anyUser) {
      startSimulatorJob(anyUser.orgId);

      logger.info(
        { orgId: anyUser.orgId.toString() },
        "Simulator job started"
      );
    } else {
      logger.error("No user found — simulator was not started");
    }

    // 8. Start API server
    httpServer.listen(env.port, () => {
      logger.info(
        { port: env.port },
        "DeployWatch API listening"
      );
    });
  } catch (err) {
    logger.error(
      { err },
      "Fatal startup error"
    );

    process.exit(1);
  }
}

main();
