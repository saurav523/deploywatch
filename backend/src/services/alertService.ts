import { IIncident } from "../models/Incident";
import { logger } from "../utils/logger";
import { eventBus, EVENTS } from "./eventBus";

/**
 * Simulates the webhook dispatch described in ARCHITECTURE.md §4/§15
 * (Slack/Teams/Discord/email). Swapping in real webhook calls is a
 * localized change to this one function — everything upstream (incident
 * detection, notification-rule matching) is unaffected.
 */
export async function dispatchAlert(incident: IIncident) {
  const payload = {
    incidentId: incident._id.toString(),
    type: incident.type,
    severity: incident.severity,
    resourceName: incident.resourceName,
    message: `[${incident.severity.toUpperCase()}] ${incident.type} on ${incident.resourceName}`,
  };

  logger.info({ payload }, "ALERT dispatched (simulated webhook)");
  eventBus.emit(EVENTS.ALERT_FIRED, payload);
  return payload;
}
