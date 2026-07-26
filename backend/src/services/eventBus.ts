import { EventEmitter } from "events";

/**
 * In-process event bus decoupling domain services from the Socket.IO
 * gateway. In the multi-instance production topology this is exactly
 * where Redis pub/sub slots in (see ARCHITECTURE.md §1, §15) without
 * any service above this needing to change.
 */
export const eventBus = new EventEmitter();
eventBus.setMaxListeners(50);

export const EVENTS = {
  HEALTH_UPDATE: "cluster:health-update",
  INCIDENT_NEW: "incident:new",
  INCIDENT_RESOLVED: "incident:resolved",
  DEPLOYMENT_STATUS_CHANGE: "deployment:status-change",
  POD_RESTART: "pod:restart",
  ALERT_FIRED: "alert:fired",
} as const;
