import { Response, NextFunction } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Incident } from "../models/Incident";
import { AuthedRequest } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { eventBus, EVENTS } from "../services/eventBus";

export async function listIncidents(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const { clusterId, status, severity } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = { orgId: req.user!.orgId };
    if (clusterId) filter.clusterId = new Types.ObjectId(clusterId);
    if (status) filter.status = status;
    if (severity) filter.severity = severity;

    const incidents = await Incident.find(filter).sort({ openedAt: -1 }).limit(200);
    res.json({ data: incidents, error: null });
  } catch (err) {
    next(err);
  }
}

export async function getIncident(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const incident = await Incident.findOne({
      _id: new Types.ObjectId(req.params.id),
      orgId: req.user!.orgId,
    });
    if (!incident) throw new AppError("Incident not found", 404);
    res.json({ data: incident, error: null });
  } catch (err) {
    next(err);
  }
}

const patchSchema = z.object({
  status: z.enum(["acknowledged", "resolved"]).optional(),
  assignedTo: z.string().optional(),
});

export async function patchIncident(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const body = patchSchema.parse(req.body);
    const incident = await Incident.findOne({
      _id: new Types.ObjectId(req.params.id),
      orgId: req.user!.orgId,
    });
    if (!incident) throw new AppError("Incident not found", 404);

    if (body.status) {
      incident.status = body.status;
      incident.timeline.push({ ts: new Date(), description: `Status changed to ${body.status}` });
      if (body.status === "resolved") incident.resolvedAt = new Date();
    }
    if (body.assignedTo) incident.assignedTo = new Types.ObjectId(body.assignedTo);
    await incident.save();

    if (body.status === "resolved") {
      eventBus.emit(EVENTS.INCIDENT_RESOLVED, { incidentId: incident._id.toString() });
    }

    res.json({ data: incident, error: null });
  } catch (err) {
    next(err);
  }
}
