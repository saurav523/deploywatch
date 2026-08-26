import mongoose from "mongoose";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { seedDatabase } from "./seed";

async function runSeed() {
  try {
    logger.info("Connecting to MongoDB for seeding...");

    await mongoose.connect(env.mongoUri);

    logger.info("MongoDB connected");

    await seedDatabase();

    logger.info("Database seeding completed successfully");
  } catch (err) {
    logger.error(
      { err },
      "Seed failed"
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();

    logger.info("MongoDB disconnected");
  }
}

runSeed();
