import { Types } from "mongoose";
import { Cluster } from "../models/Cluster";
import { NodeModel } from "../models/Node";
import { Deployment } from "../models/Deployment";
import { Pod, IPod } from "../models/Pod";
import { recalculateDeploymentHealth, recalculateClusterHealth } from "./healthEngine";
import { evaluatePod, autoResolveIfHealthy } from "./incidentEngine";
import { eventBus, EVENTS } from "./eventBus";
import { logger } from "../utils/logger";

/**
 * Stands in for the real Kubernetes ingestion workers described in
 * ARCHITECTURE.md §3 (@kubernetes/client-node Watch API against
 * EKS/AKS/GKE/on-prem). It mutates pod/node state the same shape a real
 * Watch-event normalizer would produce, then feeds it through the same
 * HealthEngine / IncidentEngine every real event would go through.
 * Swapping this for a live IClusterProvider is isolated to this file.
 */

const PHASES: IPod["phase"][] = ["Running", "Running", "Running", "Running", "Pending"];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function tickPod(pod: IPod) {
  const roll = Math.random();

  // Small chance of a new failure condition; higher chance of recovery
  // if already unhealthy, so the fleet trends back to green over time
  // (a realistic demo, not permanent chaos).
  if (pod.phase === "Running" || pod.phase === "Pending") {
    if (roll < 0.04) {
      pod.phase = "CrashLoopBackOff";
      pod.restartCount += 1;
      pod.ready = false;
      pod.lastReason = "Back-off restarting failed container";
    } else if (roll < 0.06) {
      pod.phase = "ImagePullBackOff";
      pod.ready = false;
      pod.lastReason = "Failed to pull image";
    } else if (roll < 0.1) {
      pod.restartCount += 1;
      pod.lastReason = "OOMKilled";
    } else {
      pod.phase = pickRandom(PHASES);
      pod.ready = pod.phase === "Running";
    }
  } else {
    // unhealthy pod: 55% chance it recovers this tick
    if (roll < 0.55) {
      pod.phase = "Running";
      pod.ready = true;
      pod.lastReason = undefined;
    }
  }

  pod.resourceUsage.cpuPercent = Math.max(
    2,
    Math.min(100, pod.resourceUsage.cpuPercent + (Math.random() * 20 - 10))
  );
  pod.resourceUsage.memoryPercent = Math.max(
    5,
    Math.min(100, pod.resourceUsage.memoryPercent + (Math.random() * 15 - 7))
  );
  pod.lastTransitionAt = new Date();
  await pod.save();

  await evaluatePod(pod);
  await autoResolveIfHealthy(pod);
}

async function tickNode(nodeId: Types.ObjectId) {
  const node = await NodeModel.findById(nodeId);
  if (!node) return;
  node.usage.cpuPercent = Math.max(
    5,
    Math.min(100, node.usage.cpuPercent + (Math.random() * 10 - 5))
  );
  node.usage.memoryPercent = Math.max(
    5,
    Math.min(100, node.usage.memoryPercent + (Math.random() * 10 - 5))
  );
  node.pressure.memory = node.usage.memoryPercent > 90;
  node.pressure.cpu = node.usage.cpuPercent > 90;
  node.lastSeenAt = new Date();
  await node.save();
}

export async function runSimulationTick(orgId: Types.ObjectId) {
  const clusters = await Cluster.find({ orgId });

  for (const cluster of clusters) {
    const pods = await Pod.find({ clusterId: cluster._id });
    for (const pod of pods) {
      await tickPod(pod);
    }

    const nodes = await NodeModel.find({ clusterId: cluster._id });
    for (const node of nodes) {
      await tickNode(node._id);
    }

    const deployments = await Deployment.find({ clusterId: cluster._id });
    for (const dep of deployments) {
      const depPods = await Pod.find({ deploymentId: dep._id });
      dep.replicas.ready = depPods.filter((p) => p.ready).length;
      dep.replicas.available = dep.replicas.ready;
      dep.replicas.unavailable = dep.replicas.desired - dep.replicas.ready;
      await dep.save();

      await recalculateDeploymentHealth(dep._id);
      eventBus.emit(EVENTS.DEPLOYMENT_STATUS_CHANGE, {
        clusterId: cluster._id.toString(),
        deploymentId: dep._id.toString(),
      });
    }

    const updatedCluster = await recalculateClusterHealth(cluster._id);
    if (updatedCluster) {
      eventBus.emit(EVENTS.HEALTH_UPDATE, {
        clusterId: cluster._id.toString(),
        score: updatedCluster.clusterHealthScore,
        status: updatedCluster.status,
      });
    }
  }

  logger.debug({ clusterCount: clusters.length }, "Simulation tick complete");
}
