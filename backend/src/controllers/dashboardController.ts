import { Response, NextFunction } from "express";
import { Cluster } from "../models/Cluster";
import { Deployment } from "../models/Deployment";
import { Incident } from "../models/Incident";
import { Pod } from "../models/Pod";
import { AuthedRequest } from "../middleware/auth";

/**
 * A single aggregated payload for the dashboard landing view — avoids
 * the frontend making 6 separate round trips on first paint.
 */
export async function getSummary(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user!.orgId;
    const [clusters, deployments, openIncidents, criticalIncidents, pods] = await Promise.all([
      Cluster.find({ orgId }).sort({ clusterHealthScore: 1 }),
      Deployment.find({ orgId }).sort({ healthScore: 1 }).limit(10),
      Incident.countDocuments({ orgId, status: { $ne: "resolved" } }),
      Incident.find({ orgId, status: { $ne: "resolved" }, severity: "critical" })
        .sort({ openedAt: -1 })
        .limit(10),
      Pod.countDocuments({ orgId }),
    ]);

    const avgClusterHealth = clusters.length
      ? Math.round(clusters.reduce((s, c) => s + c.clusterHealthScore, 0) / clusters.length)
      : 100;

    res.json({
      data: {
        avgClusterHealth,
        clusterCount: clusters.length,
        podCount: pods,
        openIncidentCount: openIncidents,
        clusters,
        worstDeployments: deployments,
        criticalIncidents,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
