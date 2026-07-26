import { Types } from "mongoose";
import { env } from "../config/env";
import { runSimulationTick } from "../services/simulatorService";
import { logger } from "../utils/logger";

let interval: NodeJS.Timeout | null = null;

export function startSimulatorJob(orgId: Types.ObjectId) {
  if (interval) clearInterval(interval);
  interval = setInterval(async () => {
    try {
      await runSimulationTick(orgId);
    } catch (err) {
      logger.error({ err }, "Simulation tick failed");
    }
  }, env.simulatorTickMs);
  logger.info({ tickMs: env.simulatorTickMs }, "Simulator job started");
}

export function stopSimulatorJob() {
  if (interval) clearInterval(interval);
  interval = null;
}
