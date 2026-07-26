import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Cluster } from "../models/Cluster";
import { NodeModel } from "../models/Node";
import { Deployment } from "../models/Deployment";
import { Incident } from "../models/Incident";
import { AuthedRequest } from "../middleware/auth";
import { AppError } from "../utils/AppError";

export async function listClusters(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const clusters = await Cluster.find({ orgId: req.user!.orgId }).sort({ name: 1 });
    res.json({ data: clusters, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getCluster(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const cluster = await Cluster.findOne({
      _id: new Types.ObjectId(req.params.id),
      orgId: req.user!.orgId,
    });
    if (!cluster) throw new AppError("Cluster not found", 404);

    const [nodeCount, deploymentCount, openIncidents] = await Promise.all([
      NodeModel.countDocuments({ clusterId: cluster._id }),
      Deployment.countDocuments({ clusterId: cluster._id }),
      Incident.countDocuments({ clusterId: cluster._id, status: { $ne: "resolved" } }),
    ]);

    res.json({
      data: { ...cluster.toObject(), nodeCount, deploymentCount, openIncidents },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

export async function getClusterHealth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const cluster = await Cluster.findOne({
      _id: new Types.ObjectId(req.params.id),
      orgId: req.user!.orgId,
    });
    if (!cluster) throw new AppError("Cluster not found", 404);
    res.json({
      data: {
        score: cluster.clusterHealthScore,
        status: cluster.status,
        lastSyncedAt: cluster.lastSyncedAt,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}
