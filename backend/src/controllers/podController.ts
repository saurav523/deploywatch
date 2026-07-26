import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { Pod } from "../models/Pod";
import { AuthedRequest } from "../middleware/auth";
import { AppError } from "../utils/AppError";

export async function listPods(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { clusterId } = req.params;
    const { phase, page = "1", pageSize = "50" } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {
      orgId: req.user!.orgId,
      clusterId: new Types.ObjectId(clusterId),
    };
    if (phase) filter.phase = phase;

    const pageNum = parseInt(page, 10);
    const size = parseInt(pageSize, 10);
    const [items, total] = await Promise.all([
      Pod.find(filter).sort({ lastTransitionAt: -1 }).skip((pageNum - 1) * size).limit(size),
      Pod.countDocuments(filter),
    ]);
    res.json({ data: items, meta: { page: pageNum, pageSize: size, total }, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getPod(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const pod = await Pod.findOne({ _id: new Types.ObjectId(req.params.id), orgId: req.user!.orgId });
    if (!pod) throw new AppError("Pod not found", 404);
    res.json({ data: pod, error: null });
  } catch (err) {
    next(err);
  }
}

// Simulated log tail — a real ingestion worker would stream from the
// K8s logs API; here we synthesize plausible lines from the pod's
// current phase so the LogViewer UI has something real to render.
export async function getPodLogs(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const pod = await Pod.findOne({ _id: new Types.ObjectId(req.params.id), orgId: req.user!.orgId });
    if (!pod) throw new AppError("Pod not found", 404);

    const lines: string[] = [];
    const now = Date.now();
    for (let i = 20; i >= 0; i--) {
      const ts = new Date(now - i * 2000).toISOString();
      if (pod.phase === "CrashLoopBackOff" && i < 4) {
        lines.push(`${ts} ERROR panic: connection to dependency timed out`);
      } else if (pod.phase === "ImagePullBackOff" && i < 2) {
        lines.push(`${ts} ERROR Failed to pull image: not found`);
      } else {
        lines.push(`${ts} INFO  request served in ${(Math.random() * 80 + 10).toFixed(0)}ms`);
      }
    }
    res.json({ data: { podName: pod.name, lines }, error: null });
  } catch (err) {
    next(err);
  }
}
