import { Types } from "mongoose";
import { Deployment } from "../models/Deployment";
import { Pod, IPod } from "../models/Pod";
import { Incident, IncidentType, IncidentSeverity } from "../models/Incident";
import { logger } from "../utils/logger";
import { dispatchAlert } from "./alertService";
import { eventBus, EVENTS } from "./eventBus";

interface DetectionRule {
  type: IncidentType;
  severity: IncidentSeverity;
  matches: (pod: IPod) => boolean;
  buildRootCause: (pod: IPod, deploymentName: string) => {
    possibleCauses: { cause: string; probability: number }[];
    affectedServices: string[];
    suggestedRemediation: string[];
    confidenceScore: number;
  };
}

const RULES: DetectionRule[] = [
  {
    type: "CrashLoopBackOff",
    severity: "critical",
    matches: (pod) => pod.phase === "CrashLoopBackOff",
    buildRootCause: (pod, dep) => ({
      possibleCauses: [
        { cause: "Application crashing on startup (bad config or missing dependency)", probability: 0.55 },
        { cause: "Memory limit too low, container OOM-killed then restarted", probability: 0.3 },
        { cause: "Failing readiness/liveness probe", probability: 0.15 },
      ],
      affectedServices: [dep],
      suggestedRemediation: [
        `Check recent logs for ${pod.name}`,
        "Review last rollout diff for config/env changes",
        "Verify memory limits are sized for actual usage",
      ],
      confidenceScore: 0.8,
    }),
  },
  {
    type: "ImagePullBackOff",
    severity: "high",
    matches: (pod) => pod.phase === "ImagePullBackOff",
    buildRootCause: (pod, dep) => ({
      possibleCauses: [
        { cause: "Image tag does not exist in registry", probability: 0.5 },
        { cause: "Registry authentication/imagePullSecret misconfigured", probability: 0.35 },
        { cause: "Registry rate limiting or network policy blocking pulls", probability: 0.15 },
      ],
      affectedServices: [dep],
      suggestedRemediation: [
        "Verify the image tag was pushed to the registry",
        "Check imagePullSecrets on the deployment/service account",
      ],
      confidenceScore: 0.75,
    }),
  },
  {
    type: "PodPending",
    severity: "medium",
    matches: (pod) => pod.phase === "Pending",
    buildRootCause: (pod, dep) => ({
      possibleCauses: [
        { cause: "Insufficient cluster capacity (CPU/memory) to schedule pod", probability: 0.6 },
        { cause: "No node matches pod's node selector/affinity rules", probability: 0.25 },
        { cause: "PVC not yet bound", probability: 0.15 },
      ],
      affectedServices: [dep],
      suggestedRemediation: [
        "Check node capacity and pending resource requests",
        "Review node selectors/taints against pod tolerations",
      ],
      confidenceScore: 0.65,
    }),
  },
  {
    type: "HighRestartRate",
    severity: "medium",
    matches: (pod) => pod.restartCount >= 5 && pod.phase === "Running",
    buildRootCause: (pod, dep) => ({
      possibleCauses: [
        { cause: "Memory leak causing periodic OOM restarts", probability: 0.45 },
        { cause: "Intermittent dependency failure (DB, downstream API)", probability: 0.35 },
        { cause: "Liveness probe too aggressive for slow-starting app", probability: 0.2 },
      ],
      affectedServices: [dep],
      suggestedRemediation: [
        "Plot memory usage over time to confirm leak pattern",
        "Check downstream dependency error rates during restart windows",
      ],
      confidenceScore: 0.6,
    }),
  },
];

/**
 * Evaluates a single pod against all detection rules. Called after every
 * simulated ingestion tick (mirrors: real ingestion would call this from
 * the Watch-event normalizer). Opens a new incident only if one isn't
 * already open for the same resource+type, so we don't spam duplicates.
 */
export async function evaluatePod(pod: IPod) {
  const deployment = await Deployment.findById(pod.deploymentId);
  if (!deployment) return;

  for (const rule of RULES) {
    if (!rule.matches(pod)) continue;

    const existing = await Incident.findOne({
      resourceId: pod._id,
      type: rule.type,
      status: { $ne: "resolved" },
    });
    if (existing) continue;

    const rootCause = rule.buildRootCause(pod, `${deployment.namespace}/${deployment.name}`);

    const incident = await Incident.create({
      orgId: pod.orgId,
      clusterId: pod.clusterId,
      resourceType: "pod",
      resourceId: pod._id,
      resourceName: pod.name,
      type: rule.type,
      severity: rule.severity,
      status: "open",
      rootCause,
      timeline: [{ ts: new Date(), description: `${rule.type} detected on ${pod.name}` }],
      openedAt: new Date(),
    });

    logger.warn({ incidentId: incident._id, type: rule.type }, "Incident opened");
    eventBus.emit(EVENTS.INCIDENT_NEW, {
      incidentId: incident._id.toString(),
      type: incident.type,
      severity: incident.severity,
      resourceName: incident.resourceName,
    });
    await dispatchAlert(incident);
    return incident;
  }
  return null;
}

/**
 * Auto-resolves incidents whose triggering condition has cleared —
 * e.g. a pod that was CrashLoopBackOff is now Running cleanly.
 */
export async function autoResolveIfHealthy(pod: IPod) {
  if (pod.phase !== "Running" || pod.restartCount < 5) {
    const openMatches = await Incident.find({
      resourceId: pod._id,
      status: { $ne: "resolved" },
    });
    for (const inc of openMatches) {
      const stillBad =
        (inc.type === "CrashLoopBackOff" && pod.phase === "CrashLoopBackOff") ||
        (inc.type === "ImagePullBackOff" && pod.phase === "ImagePullBackOff") ||
        (inc.type === "PodPending" && pod.phase === "Pending") ||
        (inc.type === "HighRestartRate" && pod.restartCount >= 5);
      if (!stillBad) {
        inc.status = "resolved";
        inc.resolvedAt = new Date();
        inc.timeline.push({ ts: new Date(), description: "Condition cleared, auto-resolved" });
        await inc.save();
      }
    }
  }
}
