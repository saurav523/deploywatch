import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

export async function connectDb(): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  logger.info({ uri: env.mongoUri }, "MongoDB connected");
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
