import { Types } from "mongoose";
import { Deployment } from "../models/Deployment";
import { Pod } from "../models/Pod";
import { HealthHistory } from "../models/HealthHistory";
import { Cluster } from "../models/Cluster";

/**
 * Pure scoring function — no I/O — so it's independently unit-testable
 * (see tests/health.test.ts). Mirrors the "Health Engine" spec: starts
 * at 100 and subtracts weighted penalties per detected condition.
 */
export function computeDeploymentHealth(input: {
  desiredReplicas: number;
  availableReplicas: number;
  totalRestarts: number;
  crashingPods: number;
  imagePullErrors: number;
  pendingPods: number;
}): { score: number; reasons: string[] } {
  let score = 100;
  const reasons: string[] = [];

  const unavailable = Math.max(0, input.desiredReplicas - input.availableReplicas);
  if (unavailable > 0) {
    const penalty = Math.min(40, unavailable * 15);
    score -= penalty;
    reasons.push(`${unavailable} of ${input.desiredReplicas} replicas unavailable`);
  }

  if (input.crashingPods > 0) {
    const penalty = Math.min(35, input.crashingPods * 20);
    score -= penalty;
    reasons.push(`${input.crashingPods} pod(s) in CrashLoopBackOff`);
  }

  if (input.imagePullErrors > 0) {
    score -= Math.min(25, input.imagePullErrors * 15);
    reasons.push(`${input.imagePullErrors} pod(s) with image pull errors`);
  }

  if (input.pendingPods > 0) {
    score -= Math.min(15, input.pendingPods * 8);
    reasons.push(`${input.pendingPods} pod(s) stuck Pending`);
  }

  if (input.totalRestarts >= 5) {
    score -= Math.min(20, Math.floor(input.totalRestarts / 5) * 5);
    reasons.push(`elevated restart count (${input.totalRestarts} total)`);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  if (reasons.length === 0) reasons.push("all replicas available, no restarts detected");

  return { score, reasons };
}

export async function recalculateDeploymentHealth(deploymentId: Types.ObjectId) {
  const deployment = await Deployment.findById(deploymentId);
  if (!deployment) return null;

  const pods = await Pod.find({ deploymentId });
  const totalRestarts = pods.reduce((sum, p) => sum + p.restartCount, 0);
  const crashingPods = pods.filter((p) => p.phase === "CrashLoopBackOff").length;
  const imagePullErrors = pods.filter((p) => p.phase === "ImagePullBackOff").length;
  const pendingPods = pods.filter((p) => p.phase === "Pending").length;

  const { score, reasons } = computeDeploymentHealth({
    desiredReplicas: deployment.replicas.desired,
    availableReplicas: deployment.replicas.available,
    totalRestarts,
    crashingPods,
    imagePullErrors,
    pendingPods,
  });

  deployment.healthScore = score;
  deployment.healthReasons = reasons;
  deployment.status = score >= 80 ? "healthy" : score >= 50 ? "degraded" : "failing";
  deployment.updatedAt = new Date();
  await deployment.save();

  await HealthHistory.create({
    orgId: deployment.orgId,
    clusterId: deployment.clusterId,
    resourceType: "deployment",
    resourceId: deployment._id,
    score,
    reasonCodes: reasons,
    recordedAt: new Date(),
  });

  return deployment;
}

export async function recalculateClusterHealth(clusterId: Types.ObjectId) {
  const deployments = await Deployment.find({ clusterId });
  if (deployments.length === 0) return;
  const avg = Math.round(
    deployments.reduce((sum, d) => sum + d.healthScore, 0) / deployments.length
  );
  const cluster = await Cluster.findById(clusterId);
  if (!cluster) return;
  cluster.clusterHealthScore = avg;
  cluster.status = avg >= 80 ? "healthy" : avg >= 50 ? "degraded" : "unreachable";
  cluster.lastSyncedAt = new Date();
  await cluster.save();
  return cluster;
}
