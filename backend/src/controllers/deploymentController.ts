import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Deployment } from "../models/Deployment";
import { Pod } from "../models/Pod";
import { HealthHistory } from "../models/HealthHistory";
import { AuthedRequest } from "../middleware/auth";
import { AppError } from "../utils/AppError";

export async function listDeployments(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { clusterId } = req.params;
    const { namespace, status, page = "1", pageSize = "25" } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {
      orgId: req.user!.orgId,
      clusterId: new Types.ObjectId(clusterId),
    };
    if (namespace) filter.namespace = namespace;
    if (status) filter.status = status;

    const pageNum = parseInt(page, 10);
    const size = parseInt(pageSize, 10);

    const [items, total] = await Promise.all([
      Deployment.find(filter)
        .sort({ healthScore: 1 })
        .skip((pageNum - 1) * size)
        .limit(size),
      Deployment.countDocuments(filter),
    ]);

    res.json({ data: items, meta: { page: pageNum, pageSize: size, total }, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getDeployment(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const deployment = await Deployment.findOne({
      _id: new Types.ObjectId(req.params.depId),
      orgId: req.user!.orgId,
    });
    if (!deployment) throw new AppError("Deployment not found", 404);
    res.json({ data: deployment, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getDeploymentTimeline(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const history = await HealthHistory.find({
      resourceId: new Types.ObjectId(req.params.depId),
      resourceType: "deployment",
    })
      .sort({ recordedAt: 1 })
      .limit(200);
    res.json({ data: history, error: null });
  } catch (err) {
    next(err);
  }
}

export async function listPodsForDeployment(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const pods = await Pod.find({
      deploymentId: new Types.ObjectId(req.params.depId),
      orgId: req.user!.orgId,
    }).sort({ name: 1 });
    res.json({ data: pods, error: null });
  } catch (err) {
    next(err);
  }
}
